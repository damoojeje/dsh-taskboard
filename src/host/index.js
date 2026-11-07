// Host half: read headless dispatch state, tail a dispatch log, start or stop a
// task through the existing runner, and archive a finished job off the board.
//
// Everything is scoped to the task ids declared in
// context_master/plans/dsh-tasks/tasks.json. The plugin never invents a command:
// start and restart call `python3 dsh-run.py <id>`, stop signals the runner and
// the agent it spawned. Removing a finished job moves its state file into
// ~/.dsh/tasks/archive and records the id in dismissed.json, so the task
// definition and the logs stay; nothing is deleted. Mutating calls need the
// x-taskboard header, which a cross-site page cannot set without a preflight the
// server does not allow.

import { existsSync } from 'node:fs'
import { readFile, readdir, rename, mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { open } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const name = 'taskboard'
export const inject = ['connection']

const HOME = homedir()

// Every path is overridable, and the defaults look in two conventional places so
// the plugin works in any checkout. The overrides also let the smoke test drive
// start, stop, restart and remove against a fake runner without touching real
// dispatches.
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

async function readJson(path, fallback) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'))
    return value && typeof value === 'object' ? value : fallback
  } catch {
    return fallback
  }
}

async function taskDefs() {
  const config = await readJson(TASKS_FILE, { tasks: {} })
  return config.tasks && typeof config.tasks === 'object' ? config.tasks : {}
}

async function readDismissed() {
  const value = await readJson(DISMISSED_FILE, {})
  return value && typeof value === 'object' ? value : {}
}

async function writeDismissed(value) {
  await mkdir(STATE_DIR, { recursive: true })
  const path = `${DISMISSED_FILE}.tmp`
  const handle = await open(path, 'w')
  try {
    await handle.writeFile(JSON.stringify(value, null, 2))
  } finally {
    await handle.close()
  }
  await rename(path, DISMISSED_FILE)
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

/** A task whose runner is gone is stalled, not running, whatever the file says. */
function effectivePhase(state) {
  let phase = state.state || 'queued'
  const pid = state.pid || null
  const running = alive(pid)
  if (phase === 'running' && pid && !running) phase = 'stalled'
  return { phase, running }
}

function stamp() {
  const now = new Date()
  const two = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`
}

async function snapshot(showRemoved) {
  const defs = await taskDefs()
  const dismissed = await readDismissed()
  const ids = Object.keys(defs).sort()
  const tasks = []

  for (const id of ids) {
    const def = defs[id] || {}
    const removed = Object.prototype.hasOwnProperty.call(dismissed, id)
    if (removed && !showRemoved) continue
    let state = await readJson(join(STATE_DIR, `${id}.json`), {})
    if (removed && !state.state) {
      const archived = await latestArchive(id)
      if (archived) state = archived
    }
    const used = num(state.tokens_in) + num(state.tokens_out)
    const cap = num(state.token_cap) || num(def.token_cap)
    const wall = num(state.wall_s) || num(def.wall_s)
    const { phase, running } = effectivePhase(state)
    const declared = state.pid || null

    let elapsedS = null
    if (state.started) {
      const start = Date.parse(state.started)
      const end = state.finished ? Date.parse(state.finished) : Date.now()
      if (Number.isFinite(start) && Number.isFinite(end)) {
        elapsedS = Math.max(0, Math.round((end - start) / 1000))
      }
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
      wallS: wall || null,
      tokensIn: num(state.tokens_in),
      tokensOut: num(state.tokens_out),
      cacheRead: num(state.cache_read),
      used,
      cap,
      percent: cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0,
      branch: state.branch || def.branch || null,
      worktree: state.worktree || null,
      lastCommit: state.last_commit || null,
      accept: state.accept || null,
      note: state.note || null,
      killed: state.killed || null,
      pid: declared,
      running,
      chainFrom: def.chain_from || null,
    })
  }

  const order = { running: 0, stalled: 1, blocked: 2, queued: 3, capped: 4, failed: 5, done: 6 }
  tasks.sort((a, b) => (order[a.phase] ?? 9) - (order[b.phase] ?? 9) || a.id.localeCompare(b.id))

  return {
    updatedAt: new Date().toISOString(),
    running: tasks.filter((t) => t.phase === 'running' || t.running).length,
    removedCount: Object.keys(dismissed).length,
    showRemoved: !!showRemoved,
    tasks,
  }
}

async function readTail(path, lines) {
  let text = ''
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return { text: '', truncated: false, missing: true }
  }
  let truncated = false
  if (text.length > MAX_LOG_BYTES) {
    text = text.slice(-MAX_LOG_BYTES)
    truncated = true
  }
  const parts = text.split('\n')
  const keep = Math.max(1, Math.min(1000, lines || 200))
  if (parts.length > keep) {
    truncated = true
    return { text: parts.slice(-keep).join('\n'), truncated, missing: false }
  }
  return { text, truncated, missing: false }
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
  const defs = await taskDefs()
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

/** Archive a finished job off the board. Nothing is deleted. */
async function removeTask(id) {
  const defs = await taskDefs()
  if (!Object.prototype.hasOwnProperty.call(defs, id)) {
    return { ok: false, message: `unknown task ${id}` }
  }
  const state = await readJson(join(STATE_DIR, `${id}.json`), {})
  const { phase, running } = effectivePhase(state)
  if (running) {
    return { ok: false, message: `${id} is running; stop it before removing` }
  }
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

/** Put a removed job back on the board, restoring the last archived state. */
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

async function writeTasks(defs) {
  const config = await readJson(TASKS_FILE, { tasks: {} })
  config.tasks = defs
  const path = `${TASKS_FILE}.tmp`
  await writeFile(path, JSON.stringify(config, null, 2) + '\n')
  await rename(path, TASKS_FILE)
}

/** Delete a finished job entirely: state, archive and logs. Cannot be undone. */
async function purgeTask(id) {
  const defs = await taskDefs()
  if (!Object.prototype.hasOwnProperty.call(defs, id)) {
    return { ok: false, message: `unknown task ${id}` }
  }
  const state = await readJson(join(STATE_DIR, `${id}.json`), {})
  const { phase, running } = effectivePhase(state)
  if (running) return { ok: false, message: `${id} is running; stop it before deleting` }
  const dismissed = await readDismissed()
  const removed = Object.prototype.hasOwnProperty.call(dismissed, id)
  if (!removed && !TERMINAL.includes(phase)) {
    return { ok: false, message: `${id} is ${phase}, not finished; nothing to delete` }
  }

  const targets = [
    join(STATE_DIR, `${id}.json`),
    join(STATE_DIR, `${id}.log`),
    join(STATE_DIR, `${id}.runner.log`),
    join(STATE_DIR, `${id}.accept.log`),
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
  return {
    ok: true,
    message: `deleted ${id} (${deleted} file(s)); the task definition stays, so it can run again`,
    deleted,
  }
}

/** Remove the task definition, so the id stops appearing on the board at all. */
async function forgetTask(id) {
  const defs = await taskDefs()
  if (!Object.prototype.hasOwnProperty.call(defs, id)) {
    return { ok: false, message: `unknown task ${id}` }
  }
  const state = await readJson(join(STATE_DIR, `${id}.json`), {})
  const { running } = effectivePhase(state)
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
  const routes = [
    {
      path: '/api/taskboard/state',
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async (request) => {
        const url = new URL(request.url)
        const showRemoved = url.searchParams.get('removed') === '1'
        try {
          return jsonResponse(await snapshot(showRemoved))
        } catch (error) {
          return jsonResponse({
            updatedAt: new Date().toISOString(),
            running: 0,
            removedCount: 0,
            tasks: [],
            error: String((error && error.message) || error),
          })
        }
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
        const id = body && typeof body.id === 'string' ? body.id : ''
        const action = body && typeof body.action === 'string' ? body.action : ''
        if (!/^[A-Z]$/.test(id)) return jsonResponse({ ok: false, message: 'bad id' }, 400)
        try {
          if (action === 'stop') return jsonResponse(await stopTask(id))
          if (action === 'start' || action === 'restart') {
            return jsonResponse(await startTask(id, action))
          }
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
