#!/usr/bin/env node
// Smoke test for both halves. It never touches real dispatches: every path is a
// temporary directory and the runner is a fake that writes a state file and
// sleeps. Exits non-zero on the first failed expectation.

import { mkdtemp, mkdir, writeFile, readFile, readdir, access } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

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
  const route = routes.get(`${path.split('?')[0]}:${method}`)
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
check('purge refuses a running job', (await act('purge', 'T')).body.ok === false)
check('log route answers', (await call('/api/taskboard/log?id=T', 'GET')).status === 200)
check('stop ends it', (await act('stop', 'T')).body.ok === true)
await new Promise((resolve) => setTimeout(resolve, 900))
check('stopped job reads as stalled', brief(await board()).includes('T:stalled'))

check('purge deletes an archived job', (await act('purge', 'R')).body.ok === true)
check('purged files are gone', !(await exists(join(state, 'R.json'))) && (await readdir(join(state, 'archive'))).filter((n) => n.startsWith('R-')).length === 0)
check('forget drops the definition', (await act('forget', 'R')).body.ok === true)
check('forgotten id is gone from the list', !(await readFile(tasks, 'utf8')).includes('"R"'))
check('forgotten id is gone from the board', !brief(await board('?removed=1')).includes('R:'))
check('purge clears a stalled job', (await act('purge', 'T')).body.ok === true && !(await exists(join(state, 'T.json'))))

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
