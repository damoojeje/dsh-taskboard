#!/usr/bin/env node
// Smoke test for both halves. It never touches real dispatches: every path is a
// temporary directory and the runner is a fake that writes a state file and
// sleeps. Exits non-zero on the first failed expectation.

import { mkdtemp, mkdir, writeFile, readFile, readdir, access, utimes } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Buffer } from 'node:buffer'

const exists = async (path) => access(path).then(() => true, () => false)

const root = await mkdtemp(join(tmpdir(), 'taskboard-smoke-'))
const state = join(root, 'state')
const tasks = join(root, 'tasks.json')
const runner = join(root, 'runner.py')
await mkdir(state, { recursive: true })

await writeFile(
  tasks,
  JSON.stringify({
    repo: join(root, 'repo'),
    tasks: {
      T: { name: 't', branch: 'dsh/t', token_cap: 1000, wall_s: 60, title: 'done task' },
      R: { name: 'r', branch: 'dsh/r', token_cap: 1000, wall_s: 60, title: 'stalled task' },
    },
  }),
)

await writeFile(
  runner,
  [
    'import json, os, sys, time',
    'i = sys.argv[1]',
    'state = os.path.join(os.environ["TASKBOARD_STATE"], i + ".json")',
    'with open(state, "w") as fh:',
    '    json.dump({"state": "running", "pid": os.getpid(), "title": "fake " + i,',
    '               "started": "2026-01-01T00:00:00+0000", "token_cap": 1000, "wall_s": 60,',
    '               "tokens_in": 1, "tokens_out": 1}, fh)',
    'time.sleep(120)',
    '',
  ].join('\n'),
)

const done = {
  state: 'done', accept: 'pass', title: 'done task', token_cap: 1000, wall_s: 60,
  tokens_in: 100, tokens_out: 50, started: '2026-01-01T00:00:00+0000',
  finished: '2026-01-01T00:10:00+0000', last_commit: 'abcdef1 fake',
}
await writeFile(join(state, 'T.json'), JSON.stringify(done))
await writeFile(join(state, 'R.json'), JSON.stringify({ ...done, state: 'running', pid: 999999 }))

process.env.TASKBOARD_STATE = state
process.env.TASKBOARD_TASKS = tasks
process.env.TASKBOARD_RUNNER = runner

const { apply } = await import('../src/host/index.js')

const routes = new Map()
apply({
  connection: { fetch: { register: (route) => { routes.set(`${route.path}:${route.methods.join(',')}`, route); return async () => {} } } },
  on: () => {},
})

let failures = 0
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`PASS ${label}`)
  } else {
    failures += 1
    console.log(`FAIL ${label}${detail ? `: ${detail}` : ''}`)
  }
}

const call = async (path, method, body, headers) => {
  const bare = path.split('?')[0]
  const route =
    routes.get(`${bare}:${method}`) ||
    [...routes.values()].find((value) => value.path === bare && value.methods.includes(method))
  if (!route) throw new Error(`route missing: ${method} ${path}`)
  const response = await route.fetch(
    new Request(`http://smoke${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(headers || {}) },
      body: body ? JSON.stringify(body) : undefined,
    }),
  )
  return { status: response.status, body: await response.json() }
}
const act = (action, id, headers = { 'x-taskboard': '1' }) =>
  call('/api/taskboard/action', 'POST', { action, id }, headers)
const board = async (query = '') => (await call(`/api/taskboard/state${query}`, 'GET')).body
const brief = (snapshot) =>
  snapshot.tasks.map((t) => `${t.id}:${t.phase}${t.removed ? ':removed' : ''}${t.removable ? ':removable' : ''}`).join(' ')

check('state route answers', (await call('/api/taskboard/state', 'GET')).status === 200)
check('stalled job reads as stalled', brief(await board()).includes('R:stalled'))
check('done job reads as removable', brief(await board()).includes('T:done:removable'))

check('action needs the header', (await act('remove', 'T', {})).status === 403)
check('bad id is refused', (await act('remove', 'ZZ')).status === 400)
check('stalled job is removable', (await act('remove', 'R')).body.ok === true)
check('done job is removable', (await act('remove', 'T')).body.ok === true)
const removed = brief(await board('?removed=1'))
check('removed cards show their phase', removed.includes('T:done:removed') && removed.includes('R:stalled:removed'))
check('removed cards hide by default', !brief(await board()).includes('T:'))
check('restore brings it back', (await act('restore', 'T')).body.ok && brief(await board()).includes('T:done'))

const started = await act('start', 'T')
check('start spawns the runner', started.body.ok === true, started.body.message)
await new Promise((resolve) => setTimeout(resolve, 900))
check('runner reports running', (await board()).tasks.find((t) => t.id === 'T').running === true)
check('duplicate start is refused', (await act('start', 'T')).body.ok === false)
const liveState = JSON.parse(await readFile(join(state, 'T.json'), 'utf8'))
liveState.tokens_in += 5000
await writeFile(join(state, 'T.json'), JSON.stringify(liveState))
await new Promise((resolve) => setTimeout(resolve, 50))
check('rate appears once tokens move', (await board()).tasks.find((t) => t.id === 'T').tokensPerMinute > 0)
const old = new Date(Date.now() - 20 * 60 * 1000)
await utimes(join(state, 'T.json'), old, old)
check('stale warning when the state file is old', (await board()).tasks.find((t) => t.id === 'T').stale === true)
await utimes(join(state, 'T.json'), new Date(), new Date())
check('log route answers', (await call('/api/taskboard/log?id=T', 'GET')).status === 200)
check('stop ends it', (await act('stop', 'T')).body.ok === true)
await new Promise((resolve) => setTimeout(resolve, 900))
check('stopped job reads as stalled', brief(await board()).includes('T:stalled'))

check('purge deletes an archived job', (await act('purge', 'R')).body.ok === true)
check('purged files are gone', !(await exists(join(state, 'R.json'))) && (await readdir(join(state, 'archive'))).filter((n) => n.startsWith('R-')).length === 0)
check('purged id leaves the task list', !(await readFile(tasks, 'utf8')).includes('"R"'))
check('purged id leaves the board', !brief(await board('?removed=1')).includes('R:'))
check('forget drops the definition only', (await act('forget', 'T')).body.ok === true)
check('forgotten id leaves the list and keeps its state', !(await readFile(tasks, 'utf8')).includes('"T"') && (await exists(join(state, 'T.json'))))
check('forgotten id leaves the board', !brief(await board('?removed=1')).includes('T:'))
check('purge refuses a forgotten id', (await act('purge', 'T')).body.ok === false)

// Batch actions need a live task again; add S to the list.
const config = JSON.parse(await readFile(tasks, 'utf8'))
config.tasks.S = { name: 's', branch: 'dsh/s', token_cap: 1000, wall_s: 60, title: 'batch task' }
await writeFile(tasks, JSON.stringify(config))
check('start for the batch test', (await act('start', 'S')).body.ok === true)
await new Promise((resolve) => setTimeout(resolve, 700))
check('stop-all stops it', (await act('stop-all')).body.ok === true)
await new Promise((resolve) => setTimeout(resolve, 900))
check('stop-all left it stalled', brief(await board()).includes('S:stalled'))
check('archive finished archives it', (await act('prune-finished')).body.ok === true)
check('archived job is hidden by default', !brief(await board()).includes('S:'))

// Validation must report a malformed entry instead of failing silently.
const withBad = JSON.parse(await readFile(tasks, 'utf8'))
withBad.tasks['bad id'] = { title: 'invalid' }
await writeFile(tasks, JSON.stringify(withBad))
check('validation warns about a bad id', (await board()).warnings.some((w) => w.includes('single capital letter')))
delete withBad.tasks['bad id']
await writeFile(tasks, JSON.stringify(withBad))

// The event stream must deliver a snapshot frame.
const eventsRoute = routes.get('/api/taskboard/events:GET')
const eventResponse = await eventsRoute.fetch(new Request('http://smoke/api/taskboard/events'))
check('event stream content type', eventResponse.headers.get('content-type') === 'text/event-stream')
const reader = eventResponse.body.getReader()
const first = await Promise.race([
  reader.read(),
  new Promise((resolve) => setTimeout(() => resolve({ done: true }), 3000)),
])
await reader.cancel().catch(() => {})
const frame = first && first.value ? Buffer.from(first.value).toString('utf8') : ''
check('event stream sends a snapshot', frame.startsWith('data: ') && frame.includes('"tasks"'))

// Delete works for any phase: a queued job with no state at all.
const queuedConfig = JSON.parse(await readFile(tasks, 'utf8'))
queuedConfig.tasks.Q = { name: 'q', branch: 'dsh/q', token_cap: 1000, wall_s: 60, title: 'queued task' }
await writeFile(tasks, JSON.stringify(queuedConfig))
check('delete a queued job', (await act('purge', 'Q')).body.ok === true)
check('queued job leaves the task list', !(await readFile(tasks, 'utf8')).includes('"Q"'))

// Notes round trip, then delete a running job (it must stop first).
await act('restore', 'S')
check('start before the running delete', (await act('start', 'S')).body.ok === true)
await new Promise((resolve) => setTimeout(resolve, 700))
check('notes need the header', (await call('/api/taskboard/notes', 'POST', { id: 'S', text: 'hello' }, {})).status === 403)
const noteSave = await call('/api/taskboard/notes', 'POST', { id: 'S', text: 'a note for the next person' }, { 'x-taskboard': '1' })
check('note saved and returned', noteSave.body.ok === true && noteSave.body.notes.length === 1)
const noteRead = await call('/api/taskboard/notes?id=S', 'GET')
check('note reads back', noteRead.body.notes[0].text === 'a note for the next person')
const runningDelete = await act('purge', 'S')
check('delete a running job stops it first', runningDelete.body.ok === true && runningDelete.body.stopped === true)
check('running delete removes state, notes and definition', !(await exists(join(state, 'S.json'))) && !(await exists(join(state, 'S.notes.jsonl'))) && !(await readFile(tasks, 'utf8')).includes('"S"'))
const metrics = (await board()).metrics
check('snapshot carries metrics', metrics && typeof metrics.tokensIn === 'number' && typeof metrics.jobs === 'number')

const page = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
let entry = null
const sandbox = { window: { __ModuleLoader__: { load: (value) => { entry = value } } }, console, setTimeout, clearTimeout }
const vm = await import('node:vm')
vm.runInNewContext(page, sandbox)
const react = {
  createElement: (type, props) => ({ type, props }),
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
}
const exportsObject = entry.factory((id) => {
  if (id === 'react') return react
  throw new Error(`unexpected require: ${id}`)
})
check('client exports name and apply', exportsObject.name === 'dsh-taskboard' && typeof exportsObject.apply === 'function')
const registered = []
exportsObject.apply({ slots: { inject: (name, make) => registered.push([name, make()]), register: (meta, component) => ({ meta, component }) } })
check('client registers both slots', registered.length === 2 && registered.every(([, value]) => typeof value.component === 'function'))

console.log(`\n${failures === 0 ? 'ok' : `${failures} failure(s)`} in ${root}`)
if (spawnSync('rm', ['-rf', root]).status !== 0) console.log(`note: remove ${root} yourself`)
process.exit(failures === 0 ? 0 : 1)
