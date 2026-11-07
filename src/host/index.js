// Host half: read headless dispatch state, tail a dispatch log, start or stop a
// task through the existing runner, and archive or delete a job.
//
// Everything is scoped to the task ids declared in the task list. The plugin
// never invents a command: start and restart call `python3 dsh-run.py <id>`,
// stop signals the runner and the agent it spawned. Every path is overridable so
// the smoke test can drive the whole surface against temporary directories.
//
// Mutating calls need the x-taskboard header, which a cross-site page cannot set
// without a preflight the server does not allow.

import { existsSync } from 'node:fs'
import { readFile, readdir, rename, mkdir, stat, unlink, writeFile, open } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const name = 'taskboard'
export const inject = ['connection']

const HOME = homedir()

// Paths look in two conventional places so the plugin works in any checkout.
function firstExisting(candidates) {
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      // An unreadable candidate is not the one.
    }
  }
  return candidates[0]
}

const STATE_DIR = process.env.TASKBOARD_STATE || join(HOME, '.dsh', 'tasks')
const TASKS_FILE =
  process.env.TASKBOARD_TASKS ||
  firstExisting([
    join(HOME, '.dsh', 'tasks', 'tasks.json'),
    join(HOME, 'context_master', 'plans', 'dsh-tasks', 'tasks.json'),
  ])
const RUNNER =
  process.env.TASKBOARD_RUNNER ||
  firstExisting([
    join(HOME, '.dsh', 'bin', 'dsh-run.py'),
    join(HOME, 'context_master', 'plans', 'dsh-run.py'),
  ])
const RUNNER_CWD = dirname(RUNNER)
const ARCHIVE_DIR = join(STATE_DIR, 'archive')
const DISMISSED_FILE = join(STATE_DIR, 'dismissed.json')
const MAX_LOG_BYTES = 512 * 1024
const TERMINAL = ['done', 'failed', 'capped', 'stalled']
const STALE_AFTER_MS = 10 * 60 * 1000
const RATE_WINDOW_MS = 10 * 60 * 1000
const RETENTION_DAYS = Number(process.env.TASKBOARD_RETENTION_DAYS) || 0

// Per task token samples, kept in memory, used for the rate and the estimate.
const samples = new Map()

async function readJson(path, fallback) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'))
    return value && typeof value === 'object' ? value : fallback
  } catch {
    return fallback
  }
}

/** Validate the task list instead of trusting it. Returns defs plus warnings. */
async function taskDefs() {
  const config = await readJson(TASKS_FILE, null)
  const warnings = []
  if (!config) {
    if (existsSync(TASKS_FILE)) warnings.push(`task list is not valid JSON: ${TASKS_FILE}`)
    return { defs: {}, warnings }
  }
  if (!config.tasks || typeof config.tasks !== 'object') {
    warnings.push('task list has no tasks object')
    return { defs: {}, warnings }
  }
  const defs = {}
  for (const [id, def] of Object.entries(config.tasks)) {
    if (!/^[A-Z]$/.test(id)) {
      warnings.push(`task id ${JSON.stringify(id)} is not a single capital letter, skipped`)
      continue
    }
    if (!def || typeof def !== 'object') {
      warnings.push(`task ${id} is not an object, skipped`)
      continue
    }
    const caps = []
    for (const key of ['token_cap', 'wall_s']) {
      if (def[key] !== undefined && !Number.isFinite(def[key])) {
        warnings.push(`task ${id} has a non numeric ${key}`)
        caps.push(key)
      }
    }
    defs[id] = def
    for (const key of caps) delete defs[id][key]
  }
  return { defs, warnings }
}

async function readDismissed() {
  const value = await readJson(DISMISSED_FILE, {})
  return value && typeof value === 'object' ? value : {}
}

async function writeDismissed(value) {
  await mkdir(STATE_DIR, { recursive: true })
  const path = `${DISMISSED_FILE}.tmp`
  await writeFile(path, JSON.stringify(value, null, 2))
  await rename(path, DISMISSED_FILE)
}

async function writeTasks(defs) {
  const config = (await readJson(TASKS_FILE, {})) || {}
  config.tasks = defs
  const path = `${TASKS_FILE}.tmp`
  await writeFile(path, JSON.stringify(config, null, 2) + '\n')
  await rename(path, TASKS_FILE)
}

function alive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function num(value) {
  return Number.isFinite(value) ? value : 0
}

/** Process start time in epoch milliseconds, or null when it cannot be read. */
async function processStartMs(pid) {
  try {
    const raw = await readFile(`/proc/${pid}/stat`, 'utf8')
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ')
    const ticks = Number(fields[19])
    const btime = Number((await readFile('/proc/stat', 'utf8')).match(/^btime (\d+)$/m)?.[1])
    if (!Number.isFinite(ticks) || !Number.isFinite(btime)) return null
    return btime * 1000 + (ticks * 1000) / 100
  } catch {
    return null
  }
}

/**
 * A task whose runner is gone is stalled, whatever the file says. A pid that
 * started well before the task did is a recycled pid, so it counts as gone too.
 */
async function effectivePhase(state) {
  let phase = state.state || 'queued'
  const pid = state.pid || null
  const running = alive(pid)
  if (phase === 'running' && pid && !running) phase = 'stalled'
  if (phase === 'running' && pid && running && state.started) {
    const startedMs = Date.parse(state.started)
    const pidMs = await processStartMs(pid)
    if (Number.isFinite(startedMs) && Number.isFinite(pidMs) && pidMs < startedMs - 5000) {
      phase = 'stalled'
    }
  }
  return { phase, running }
}

function rateFor(id, used, cap) {
  const now = Date.now()
  const list = (samples.get(id) || []).filter((point) => now - point.t <= RATE_WINDOW_MS)
  list.push({ t: now, used })
  samples.set(id, list)
  if (list.length < 2) return { tokensPerMinute: 0, etaSeconds: null }
  const first = list[0]
  const minutes = (now - first.t) / 60000
  if (minutes <= 0) return { tokensPerMinute: 0, etaSeconds: null }
  const perMinute = Math.max(0, (used - first.used) / minutes)
  const remaining = cap > 0 ? Math.max(0, cap - used) : 0
  return {
    tokensPerMinute: Math.round(perMinute),
    etaSeconds: perMinute > 0 && cap > 0 ? Math.round((remaining / perMinute) * 60) : null,
  }
}

async function snapshot(includeRemoved) {
  const { defs, warnings } = await taskDefs()
  const dismissed = await readDismissed()
  const ids = Object.keys(defs).sort()
  const tasks = []

  for (const id of ids) {
    const def = defs[id] || {}
    const removed = Object.prototype.hasOwnProperty.call(dismissed, id)
    if (removed && !includeRemoved) continue
    let state = await readJson(join(STATE_DIR, `${id}.json`), {})
    if (removed && !state.state) {
      const archived = await latestArchive(id)
      if (archived) state = archived
    }
    const statePath = join(STATE_DIR, `${id}.json`)
    let stateAgeS = null
    try {
      stateAgeS = Math.round((Date.now() - (await stat(statePath)).mtimeMs) / 1000)
    } catch {
      stateAgeS = null
    }

    const used = num(state.tokens_in) + num(state.tokens_out)
    const cap = num(state.token_cap) || num(def.token_cap)
    const wall = num(state.wall_s) || num(def.wall_s)
    const { phase, running } = await effectivePhase(state)
    const declared = state.pid || null

    let elapsedS = null
    if (state.started) {
      const start = Date.parse(state.started)
      const end = state.finished ? Date.parse(state.finished) : Date.now()
      if (Number.isFinite(start) && Number.isFinite(end)) {
        elapsedS = Math.max(0, Math.round((end - start) / 1000))
      }
    }

    const { tokensPerMinute, etaSeconds } = running ? rateFor(id, used, cap) : { tokensPerMinute: 0, etaSeconds: null }
    const stale = phase === 'running' && stateAgeS !== null && stateAgeS > STALE_AFTER_MS / 1000
    const chainFrom = def.chain_from || null
    let parent = null
    if (chainFrom && defs[chainFrom]) {
      const parentState = await readJson(join(STATE_DIR, `${chainFrom}.json`), {})
      parent = { id: chainFrom, phase: (await effectivePhase(parentState)).phase }
    }

    tasks.push({
      id,
      title: state.title || def.title || id,
      phase,
      removed,
      removable: !running && TERMINAL.includes(phase),
      started: state.started || null,
      finished: state.finished || null,
      elapsedS,
      stateAgeS,
      stale,
      wallS: wall || null,
      tokensIn: num(state.tokens_in),
      tokensOut: num(state.tokens_out),
      cacheRead: num(state.cache_read),
      used,
      cap,
      percent: cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0,
      tokensPerMinute,
      etaSeconds,
      branch: state.branch || def.branch || null,
      worktree: state.worktree || null,
      lastCommit: state.last_commit || null,
      accept: state.accept || null,
      note: state.note || null,
      killed: state.killed || null,
      pid: declared,
      running,
      chainFrom,
      parent,
    })
  }

  const order = { running: 0, stalled: 1, blocked: 2, queued: 3, capped: 4, failed: 5, done: 6 }
  tasks.sort((a, b) => (order[a.phase] ?? 9) - (order[b.phase] ?? 9) || a.id.localeCompare(b.id))

  return {
    updatedAt: new Date().toISOString(),
    running: tasks.filter((t) => t.phase === 'running' || t.running).length,
    removedCount: Object.keys(dismissed).length,
    warnings,
    metrics: {
      jobs: tasks.length,
      phases: tasks.reduce((acc, t) => { acc[t.phase] = (acc[t.phase] || 0) + 1; return acc }, {}),
      tokensIn: tasks.reduce((sum, t) => sum + t.tokensIn, 0),
      tokensOut: tasks.reduce((sum, t) => sum + t.tokensOut, 0),
      cacheRead: tasks.reduce((sum, t) => sum + t.cacheRead, 0),
      cap: tasks.reduce((sum, t) => sum + t.cap, 0),
      acceptPass: tasks.filter((t) => t.accept === 'pass').length,
      acceptFail: tasks.filter((t) => t.accept === 'fail').length,
    },
    tasks,
  }
}

/** Read the tail of a file without loading the whole thing. */
async function readTail(path, lines) {
  let handle = null
  try {
    handle = await open(path, 'r')
    const { size } = await handle.stat()
    const length = Math.min(size, MAX_LOG_BYTES)
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, size - length)
    const text = buffer.toString('utf8')
    const parts = text.split('\n')
    const keep = Math.max(1, Math.min(1000, lines || 200))
    if (parts.length > keep) {
      return { text: parts.slice(-keep).join('\n'), truncated: true, missing: false }
    }
    return { text, truncated: size > length, missing: false }
  } catch {
    return { text: '', truncated: false, missing: true }
  } finally {
    if (handle) await handle.close().catch(() => {})
  }
}

async function latestArchive(id) {
  try {
    const files = (await readdir(ARCHIVE_DIR))
      .filter((name) => name.startsWith(`${id}-`) && name.endsWith('.json'))
      .sort()
    if (files.length === 0) return null
    return await readJson(join(ARCHIVE_DIR, files[files.length - 1]), null)
  } catch {
    return null
  }
}

/** Collect a process and everything it spawned. */
async function descendants(pid) {
  let entries = []
  try {
    entries = await readdir('/proc')
  } catch {
    return [pid]
  }
  const parents = new Map()
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue
    try {
      const raw = await readFile(`/proc/${entry}/stat`, 'utf8')
      const ppid = Number(raw.slice(raw.lastIndexOf(')') + 2).split(' ')[1])
      parents.set(Number(entry), ppid)
    } catch {
      // The process vanished between readdir and read.
    }
  }
  const tree = [pid]
  for (let index = 0; index < tree.length; index += 1) {
    for (const [child, parent] of parents) {
      if (parent === tree[index] && !tree.includes(child)) tree.push(child)
    }
  }
  return tree
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function stopTask(id) {
  const state = await readJson(join(STATE_DIR, `${id}.json`), {})
  const pid = state.pid
  if (!pid || !alive(pid)) return { ok: false, message: `${id} is not running` }
  const tree = await descendants(pid)
  for (const target of [...tree].reverse()) {
    try {
      process.kill(target, 'SIGTERM')
    } catch {
      // already gone
    }
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(500)
    if (!alive(pid)) break
  }
  if (alive(pid)) {
    for (const target of tree) {
      try {
        process.kill(target, 'SIGKILL')
      } catch {
        // already gone
      }
    }
  }
  return { ok: true, message: `stopped ${id} (${tree.length} process(es))` }
}

async function startTask(id, action) {
  const { defs } = await taskDefs()
  if (!Object.prototype.hasOwnProperty.call(defs, id)) {
    return { ok: false, message: `unknown task ${id}` }
  }
  const state = await readJson(join(STATE_DIR, `${id}.json`), {})
  if (state.pid && alive(state.pid)) {
    if (action !== 'restart') {
      return { ok: false, message: `${id} is already running (pid ${state.pid})` }
    }
    const stopped = await stopTask(id)
    if (!stopped.ok) return stopped
  }

  let logHandle = null
  try {
    logHandle = await open(join(STATE_DIR, `${id}.runner.log`), 'a')
  } catch {
    logHandle = null
  }

  const child = spawn('setsid', ['python3', RUNNER, id], {
    cwd: RUNNER_CWD,
    detached: true,
    stdio: ['ignore', logHandle ? logHandle.fd : 'ignore', logHandle ? logHandle.fd : 'ignore'],
  })
  child.unref()
  if (logHandle) logHandle.close().catch(() => {})

  return {
    ok: true,
    message: `${action === 'restart' ? 'restarted' : 'started'} ${id} (runner pid ${child.pid})`,
    pid: child.pid,
  }
}

async function stopAll() {
  const { defs } = await taskDefs()
  const stopped = []
  for (const id of Object.keys(defs)) {
    const state = await readJson(join(STATE_DIR, `${id}.json`), {})
    if (state.pid && alive(state.pid)) {
      const result = await stopTask(id)
      stopped.push(`${id}:${result.ok ? 'stopped' : result.message}`)
    }
  }
  return {
    ok: true,
    message: stopped.length ? `stopped ${stopped.join(', ')}` : 'nothing is running',
  }
}

async function pruneFinished() {
  const { defs } = await taskDefs()
  const archived = []
  for (const id of Object.keys(defs)) {
    const state = await readJson(join(STATE_DIR, `${id}.json`), {})
    const { phase, running } = await effectivePhase(state)
    if (running || !TERMINAL.includes(phase)) continue
    const result = await removeTask(id)
    if (result.ok) archived.push(id)
  }
  return {
    ok: true,
    message: archived.length ? `archived ${archived.join(', ')}` : 'no finished job to archive',
  }
}

/** Archive a finished job off the board. Nothing is deleted. */
async function removeTask(id) {
  const { defs } = await taskDefs()
  if (!Object.prototype.hasOwnProperty.call(defs, id)) {
    return { ok: false, message: `unknown task ${id}` }
  }
  const state = await readJson(join(STATE_DIR, `${id}.json`), {})
  const { phase, running } = await effectivePhase(state)
  if (running) return { ok: false, message: `${id} is running; stop it before removing` }
  if (!TERMINAL.includes(phase)) {
    return { ok: false, message: `${id} is ${phase}, not finished; nothing to remove` }
  }

  const dismissed = await readDismissed()
  let archived = null
  const source = join(STATE_DIR, `${id}.json`)
  try {
    await stat(source)
    await mkdir(ARCHIVE_DIR, { recursive: true })
    archived = join(ARCHIVE_DIR, `${id}-${stamp()}.json`)
    await rename(source, archived)
  } catch {
    archived = null
  }
  dismissed[id] = { at: new Date().toISOString(), archived, note: 'removed from the board' }
  await writeDismissed(dismissed)
  return {
    ok: true,
    message: `removed ${id}${archived ? ' and archived its state' : ''}; the task definition and logs stay`,
    archived,
  }
}

async function restoreTask(id) {
  const dismissed = await readDismissed()
  if (!Object.prototype.hasOwnProperty.call(dismissed, id)) {
    return { ok: false, message: `${id} is not removed` }
  }
  let restored = null
  try {
    const files = (await readdir(ARCHIVE_DIR)).filter((name) => name.startsWith(`${id}-`) && name.endsWith('.json')).sort()
    if (files.length > 0) {
      const from = join(ARCHIVE_DIR, files[files.length - 1])
      await rename(from, join(STATE_DIR, `${id}.json`))
      restored = from
    }
  } catch {
    restored = null
  }
  delete dismissed[id]
  await writeDismissed(dismissed)
  return { ok: true, message: `restored ${id}${restored ? ' from its archived state' : ' (no archived state)'}` }
}

/** Delete a finished job entirely, including its definition. Cannot be undone. */
async function purgeTask(id) {
  const { defs } = await taskDefs()
  if (!Object.prototype.hasOwnProperty.call(defs, id)) {
    return { ok: false, message: `unknown task ${id}` }
  }
  const state = await readJson(join(STATE_DIR, `${id}.json`), {})
  const { running } = await effectivePhase(state)
  let stopped = false
  if (running) {
    const result = await stopTask(id)
    if (!result.ok) return result
    stopped = true
    await sleep(300)
  }
  const dismissed = await readDismissed()
  const removed = Object.prototype.hasOwnProperty.call(dismissed, id)

  const targets = [
    join(STATE_DIR, `${id}.json`),
    join(STATE_DIR, `${id}.log`),
    join(STATE_DIR, `${id}.runner.log`),
    join(STATE_DIR, `${id}.accept.log`),
    join(STATE_DIR, `${id}.notes.jsonl`),
  ]
  try {
    const archived = (await readdir(ARCHIVE_DIR)).filter((name) => name.startsWith(`${id}-`) && name.endsWith('.json'))
    for (const name of archived) targets.push(join(ARCHIVE_DIR, name))
  } catch {
    // No archive yet.
  }

  let deleted = 0
  for (const path of targets) {
    try {
      await unlink(path)
      deleted += 1
    } catch {
      // Already gone.
    }
  }
  if (removed) {
    delete dismissed[id]
    await writeDismissed(dismissed)
  }
  delete defs[id]
  await writeTasks(defs)
  samples.delete(id)
  return {
    ok: true,
    message: `deleted ${id}: ${deleted} file(s) removed and the task is no longer declared${stopped ? ' (it was running, stopped first)' : ''}`,
    deleted,
    stopped,
  }
}

function notesPath(id) {
  return join(STATE_DIR, `${id}.notes.jsonl`)
}

/** Read the last hundred notes for a task. */
async function readNotes(id) {
  try {
    const raw = await readFile(notesPath(id), 'utf8')
    const notes = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        if (parsed && typeof parsed.text === 'string') notes.push({ at: parsed.at || null, text: parsed.text })
      } catch {
        // A damaged line does not hide the rest.
      }
    }
    return notes.slice(-100)
  } catch {
    return []
  }
}

/** Append one note, capped so a paste cannot grow the file forever. */
async function addNote(id, text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return { ok: false, message: 'the note is empty' }
  if (trimmed.length > 2000) return { ok: false, message: 'the note is longer than 2000 characters' }
  await mkdir(STATE_DIR, { recursive: true })
  const line = JSON.stringify({ at: new Date().toISOString(), text: trimmed }) + '\n'
  await writeFile(notesPath(id), line, { flag: 'a' })
  return { ok: true, message: 'note saved', notes: await readNotes(id) }
}

async function forgetTask(id) {
  const { defs } = await taskDefs()
  if (!Object.prototype.hasOwnProperty.call(defs, id)) {
    return { ok: false, message: `unknown task ${id}` }
  }
  const state = await readJson(join(STATE_DIR, `${id}.json`), {})
  const { running } = await effectivePhase(state)
  if (running) return { ok: false, message: `${id} is running; stop it before forgetting` }

  delete defs[id]
  await writeTasks(defs)
  const dismissed = await readDismissed()
  if (Object.prototype.hasOwnProperty.call(dismissed, id)) {
    delete dismissed[id]
    await writeDismissed(dismissed)
  }
  return { ok: true, message: `forgot ${id}; it is no longer declared in the task list` }
}

/** Delete archives older than TASKBOARD_RETENTION_DAYS, when that is set. */
async function sweepArchive() {
  if (!(RETENTION_DAYS > 0)) return 0
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  let removed = 0
  try {
    for (const name of await readdir(ARCHIVE_DIR)) {
      const path = join(ARCHIVE_DIR, name)
      try {
        if ((await stat(path)).mtimeMs < cutoff) {
          await unlink(path)
          removed += 1
        }
      } catch {
        // Gone already.
      }
    }
  } catch {
    // No archive.
  }
  return removed
}

function stamp() {
  const now = new Date()
  const two = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function apply(ctx) {
  sweepArchive().catch(() => {})

  const routes = [
    {
      path: '/api/taskboard/state',
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async (request) => {
        const url = new URL(request.url)
        const includeRemoved = url.searchParams.get('removed') === '1'
        try {
          return jsonResponse(await snapshot(includeRemoved))
        } catch (error) {
          return jsonResponse({
            updatedAt: new Date().toISOString(),
            running: 0,
            removedCount: 0,
            warnings: [],
            tasks: [],
            error: String((error && error.message) || error),
          })
        }
      },
    },
    {
      path: '/api/taskboard/events',
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async () => {
        const encoder = new TextEncoder()
        let timer = null
        const stream = new ReadableStream({
          start(controller) {
            const send = async () => {
              try {
                const payload = await snapshot(true)
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
              } catch {
                // A failed snapshot must not tear down the stream.
              }
            }
            send()
            timer = setInterval(send, 3000)
          },
          cancel() {
            if (timer) clearInterval(timer)
          },
        })
        return new Response(stream, {
          headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-store',
            connection: 'keep-alive',
          },
        })
      },
    },
    {
      path: '/api/taskboard/notes',
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        if (request.method === 'POST' && request.headers.get('x-taskboard') !== '1') {
          return jsonResponse({ ok: false, message: 'missing x-taskboard header' }, 403)
        }
        if (request.method === 'GET') {
          const id = new URL(request.url).searchParams.get('id') || ''
          if (!/^[A-Z]$/.test(id)) return jsonResponse({ error: 'bad id' }, 400)
          return jsonResponse({ id, notes: await readNotes(id) })
        }
        let body = null
        try {
          body = await request.json()
        } catch {
          return jsonResponse({ ok: false, message: 'body is not JSON' }, 400)
        }
        const id = body && typeof body.id === 'string' ? body.id : ''
        if (!/^[A-Z]$/.test(id)) return jsonResponse({ ok: false, message: 'bad id' }, 400)
        return jsonResponse(await addNote(id, body && body.text))
      },
    },
    {
      path: '/api/taskboard/log',
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async (request) => {
        const url = new URL(request.url)
        const id = url.searchParams.get('id') || ''
        if (!/^[A-Z]$/.test(id)) return jsonResponse({ error: 'bad id' }, 400)
        const lines = Number(url.searchParams.get('lines')) || 200
        const result = await readTail(join(STATE_DIR, `${id}.log`), lines)
        return jsonResponse({ id, ...result })
      },
    },
    {
      path: '/api/taskboard/action',
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        if (request.headers.get('x-taskboard') !== '1') {
          return jsonResponse({ ok: false, message: 'missing x-taskboard header' }, 403)
        }
        let body = null
        try {
          body = await request.json()
        } catch {
          return jsonResponse({ ok: false, message: 'body is not JSON' }, 400)
        }
        const action = body && typeof body.action === 'string' ? body.action : ''
        const id = body && typeof body.id === 'string' ? body.id : ''
        try {
          if (action === 'stop-all') return jsonResponse(await stopAll())
          if (action === 'prune-finished') return jsonResponse(await pruneFinished())
          if (!/^[A-Z]$/.test(id)) return jsonResponse({ ok: false, message: 'bad id' }, 400)
          if (action === 'stop') return jsonResponse(await stopTask(id))
          if (action === 'start' || action === 'restart') return jsonResponse(await startTask(id, action))
          if (action === 'remove') return jsonResponse(await removeTask(id))
          if (action === 'restore') return jsonResponse(await restoreTask(id))
          if (action === 'purge') return jsonResponse(await purgeTask(id))
          if (action === 'forget') return jsonResponse(await forgetTask(id))
          return jsonResponse({ ok: false, message: `unknown action ${action}` }, 400)
        } catch (error) {
          return jsonResponse({ ok: false, message: String((error && error.message) || error) }, 500)
        }
      },
    },
  ]

  const disposers = routes.map((route) => ctx.connection.fetch.register(route))
  ctx.on('dispose', () => {
    for (const dispose of disposers) {
      try {
        const pending = dispose()
        if (pending && typeof pending.catch === 'function') pending.catch(() => {})
      } catch {
        // Disposal must never throw out of the plugin.
      }
    }
  })
}
