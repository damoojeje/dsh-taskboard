# Usage

The panel lives in the Web sidebar as **Dispatches**. It has no configuration inside
the app; everything it reads comes from the task files described below.

## The board

Each card shows:

- the task id and its title;
- the phase, with a colour, plus the start clock time or the finish time;
- elapsed time against the wall clock cap;
- tokens used against the token cap, with a bar and the cache read figure;
- the branch and the last commit subject;
- the acceptance verdict, `accept pass` or `accept fail`;
- the runner note, when one is set;
- buttons: `Open log`, and the actions allowed for that phase.

The card order is running first, then stalled, blocked, queued, capped, failed and done.
The header counts running jobs and the total on the board.

## States

| Phase | Meaning | Actions offered |
|---|---|---|
| `queued` | Declared, never started. | `Start` |
| `running` | The runner pid is alive. | `Open log`, `Restart`, `Stop` |
| `stalled` | The state says running but the pid is gone. The runner died or the host rebooted. | `Open log`, `Start`, `Remove` |
| `blocked` | Waiting on another task, usually a chain parent that has not passed. | `Start` |
| `capped` | The token or wall clock cap ended it. | `Open log`, `Start`, `Remove` |
| `failed` | Acceptance failed. | `Open log`, `Start`, `Remove` |
| `done` | Acceptance passed. | `Open log`, `Start`, `Remove` |

`Start` on a finished job runs it again. `Restart` stops a running job and starts it
again in one step, with no gap in the card.

## Actions and their confirmations

Every action asks once before it does anything. The confirmation names the cost or the
effect: the token cap for `start` and `restart`, the termination for `stop`, and the fact
that state is archived while logs and the task definition stay for `remove`.

What each action calls:

- `start` runs `setsid python3 <TASKBOARD_RUNNER> <id>` in the runner's directory,
  detached, with the runner's own output appended to `<id>.runner.log`. It is refused
  while the declared pid is alive.
- `restart` is `stop` then `start`, in that order.
- `stop` sends `SIGTERM` to the runner and to every descendant it can see in `/proc`,
  waits up to six seconds, then sends `SIGKILL` to whatever remains.
- `remove` archives a finished job: the state file moves to `archive/<id>-<stamp>.json`
  and the id is recorded in `dismissed.json`. The card disappears.
- `restore` moves the newest archive for that id back to `<id>.json` and clears the
  dismissal.

## The log

`Open log` requests the last 200 lines of `<id>.log` and refreshes every two seconds
while it is open. The viewer scrolls to the end on each refresh. Long logs are cut to a
512 KiB window at the host, so the browser never receives an unbounded body. When a job
has no log yet, the card says so instead of showing an empty box.

## Archive layout

```
~/.dsh/tasks/
  tasks.json              task list
  dismissed.json          {"A": {"at": "...", "archived": "...", "note": "..."}}
  archive/
    A-20261107-110823.json
  A.json                  live state
  A.log                   agent output
  A.accept.log            acceptance output, when the runner writes one
  A.runner.log            runner output from a panel start
```

Removal never deletes the log or the acceptance output. To clear a task completely,
restore it, then delete its files while the panel is not showing it, or start it again
and let the runner rewrite the state.

## Recovery

- A job stuck in `running` with a dead pid shows as `stalled` after the next poll
  (five seconds). Use `Start` to run it again, or `Remove` to clear it.
- A restored job shows the phase from its archived state. If the runner had not written
  a state yet, the restored job reads as `queued`.
- If the panel shows "status unavailable", the host route failed. Check that the Web
  server is up and that the plugin is enabled on the Plugins page.
- If a button reports "unknown task", the id is not in the task list the host reads.
  Check `TASKBOARD_TASKS` on the server process.
- If `Start` reports a runner pid but the card stays `queued`, the runner exited before
  writing a state. Read `<id>.runner.log`.

## Troubleshooting the install

- **A new route answers 404 after an update.** The installed copy is stale. pnpm
  hardlinks a `file:` dependency, and a rewritten host file becomes a new inode. Copy
  `lib/index.js` and `lib/client.js` into the profile's `node_modules/dsh-taskboard/lib`
  and reload.
- **The panel appears but the buttons do nothing.** The page is running an older client
  bundle. Reload the tab, or restart `dsh web`.
- **Actions fail with a 403.** The request lost the `x-taskboard` header, which happens
  when a proxy rewrites headers. Use the panel rather than a direct POST.
