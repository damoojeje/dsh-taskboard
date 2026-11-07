# dsh-taskboard

A sidebar panel for headless dispatches in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
It shows every dispatch as a card with its phase, elapsed time, token budget, branch,
last commit and acceptance verdict, tails the agent log live, and lets you start, stop,
restart or archive a job from the browser instead of a terminal.

Headless work runs for hours. Without a panel the only window into it is a log file and
a status script. This puts that window in the sidebar.

## Features

| Feature | What it does |
|---|---|
| Board | One card per dispatch: phase, start or finish time, elapsed against the wall clock cap, tokens against the token cap, branch, last commit, acceptance verdict. |
| Live log | `Open log` tails the agent log, refreshed every two seconds, scrolled to the end. |
| Actions | `Start`, `Stop`, `Restart`, each behind a confirmation row that names the token cap. |
| Archive | `Remove` a finished job. Its state is archived and the card hidden; `Show removed` and `Restore` bring it back. |
| Delete | `Delete` an archived job for good: its state, archive, logs and its place in the task list. `Forget` drops only the definition and keeps the files. Both are permanent and both ask first. |
| Updates | Polls the host every five seconds. A phase change is marked `new` for two minutes and announced with `aria-live`. |
| Filter and sections | Text filter over id, title, branch and phase. Active and Finished sections, Finished collapsible. |
| Live stream | Server sent events push each snapshot; polling is the fallback when the stream drops. |
| Diagnostics | Warns when a running job stops updating its state file, and shows the token rate and an estimate to the cap. |
| Batch | Stop all running jobs, or archive every finished job, each behind one confirmation. |
| Comforts | Copy branch or log, persisted filter and toggles, notifications on completion, `Escape` closes a confirmation or the log. |

## Install

Requirements: DeepSeek Harness 0.2.1-rc.2 or a compatible release, Node 22 or newer,
and Linux for the start, stop and restart actions, which use process signals.

```bash
git clone https://github.com/damoojeje/dsh-taskboard.git
cd dsh-taskboard
npm install
npm run build
dsh plugin --profile web add link:"$PWD"
```

Then reload the Web app. A restart of `dsh web` is the certain path. A plugin toggle on
the Plugins page applies through HMR on most builds.

Use `link:` rather than `file:` while developing. pnpm caches and hardlinks a `file:`
dependency, so later edits to the checkout are not visible until a reinstall; a `link:`
dependency is a symlink and picks up every edit.

The published package ships a built `lib/client.js`, so `npm install` and
`npm run build` are only needed when you change the client source.

## Task files

The panel reads a task list and one state file per task. It writes nothing except its
own archive.

`tasks.json`:

```json
{
  "repo": "/srv/project",
  "tasks": {
    "A": {
      "name": "example-task",
      "branch": "dsh/example-task",
      "base": "main",
      "token_cap": 2000000,
      "wall_s": 14400,
      "title": "short human title",
      "chain_from": null
    }
  }
}
```

`<id>.json`, written by whatever runs the dispatch:

```json
{
  "state": "running",
  "title": "short human title",
  "pid": 4242,
  "started": "2026-11-06T14:35:10-0600",
  "finished": null,
  "token_cap": 2000000,
  "wall_s": 14400,
  "tokens_in": 181770,
  "tokens_out": 107602,
  "cache_read": 8105984,
  "last_commit": "43e8953 message",
  "accept": null,
  "note": null
}
```

Phases the panel understands: `queued`, `running`, `blocked`, `stalled`, `capped`,
`failed`, `done`. A task whose state says `running` but whose pid is gone is shown as
`stalled`. `accept` is `pass`, `fail` or absent.

## Configuration

All paths are overridable with environment variables on the `dsh web` process:

| Variable | Default | Meaning |
|---|---|---|
| `TASKBOARD_STATE` | `~/.dsh/tasks` | Directory holding `<id>.json`, `<id>.log` and the archive. |
| `TASKBOARD_TASKS` | first of `~/.dsh/tasks/tasks.json` or `~/context_master/plans/dsh-tasks/tasks.json` that exists | The task list. |
| `TASKBOARD_RUNNER` | first of `~/.dsh/bin/dsh-run.py` or `~/context_master/plans/dsh-run.py` that exists | The command `Start` and `Restart` run. |
| `TASKBOARD_RETENTION_DAYS` | unset | When set, archives older than this many days are deleted when the host loads the plugin. |

`Start` and `Restart` spawn exactly `setsid python3 <TASKBOARD_RUNNER> <id>`. No command
text comes from the browser.

The plugin also expects `<id>.log`, the agent output the panel tails. It is optional:
a card without one shows "No log yet".

## HTTP surface

Three exact routes below `/api`, reachable only by the owner peer of the Web
connection:

| Route | Method | Purpose |
|---|---|---|
| `/api/taskboard/state` | GET | Snapshot. `?removed=1` includes archived jobs. |
| `/api/taskboard/events` | GET | Server sent event stream, one snapshot frame every three seconds. |
| `/api/taskboard/log` | GET | `?id=A&lines=200`, the tail of the agent log. |
| `/api/taskboard/action` | POST | `{ "id": "A", "action": "start" }` with actions `start`, `stop`, `restart`, `remove`, `restore`. |

Mutating calls must carry `x-taskboard: 1`. A cross-site page cannot set that header
without a preflight the API fence does not grant, which makes a drive-by request from
another tab fail.

Guards: only ids declared in `tasks.json` are accepted; `start` is refused while the
declared pid is alive; `remove` is refused for a live job and for a phase that is not
finished; `stop` signals the runner and every process it spawned.

## Project layout

```
src/host/index.js     host half, loaded from source
src/client/index.jsx  client source
lib/client.js         built browser bundle, committed
tests/smoke.mjs       host and bundle checks, temporary directories only
scripts/wrap.cjs      CommonJS to module loader factory
docs/                 usage and architecture
```

## Development

```bash
npm install
npm run build      # esbuild bundles src/client.jsx, wraps it for the module loader
npm test           # smoke test: host routes and bundle registration in temp dirs
```

Run `npm test` before you open a pull request. It uses a fake runner and temporary
directories, so it never touches a real dispatch.

With a `link:` install there is no copy step. With a `file:` install, pnpm hardlinks the
package and a rewritten host file becomes a new inode, so the installed copy silently
keeps the old code. Symptom: a new route answers 404. Reinstall, or copy the host file
into the profile.

## Documentation

- [docs/USAGE.md](docs/USAGE.md): day to day use, states, actions, archive and delete, recovery.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the two halves, slots, routes, process control and limits.
- [ROADMAP.md](ROADMAP.md): the review, what is next and the technical debt.
- [CHANGELOG.md](CHANGELOG.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Compatibility

Built against DeepSeek Harness 0.2.1-rc.2. The client half depends on the sidebar
panellist slot and on React 18 or 19 being provided by the page. The host half depends
on the `/api` fetch-route registry, the `x-taskboard` header check and `/proc` for
process trees, so start, stop and restart are Linux only.

## License

MIT. See [LICENSE](LICENSE).
