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

## Board controls

- **Filter** matches id, title, branch and phase, case insensitively. It persists.
- **Active** holds running, stalled, blocked and queued jobs. **Finished** holds capped,
  failed and done jobs, and it collapses with `Hide`.
- **Stop all (n)** terminates every running job, behind one confirmation that names the
  count.
- **Archive finished (n)** moves every finished job to the archive in one step.
- **Show removed (n)** reveals archived jobs, each with Restore, Delete and Forget.
- **Notify me** asks the browser for notification permission and announces a job that
  finishes while the panel is open.
- **Copy branch** and **Copy log** put the branch name or the visible log tail on the
  clipboard.
- `Escape` closes a confirmation first, then the open log.

Filter, show removed, the finished section, the open log and the notification choice are
kept in `localStorage`, so a refresh returns to the same view.

## Diagnostics

- **No runner update in Xm** appears when a running job has not written its state file
  for ten minutes. It usually means a hung agent or a runner that died without a signal.
- **Tokens per minute** is sampled from the snapshot stream over a ten minute window, and
  the card estimates the time to the token cap from it. The figure is blank until two
  samples exist, so it is empty right after a host restart.
- A parent card is named on its child, with the parent phase, so a blocked job explains
  itself without opening the other card.

## Retention

Set `TASKBOARD_RETENTION_DAYS` on the `dsh web` process to delete archived states older
than that many days when the plugin loads. Unset means archives are kept until you delete
them.

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
| removed | Archived, hidden by default. `Show removed` reveals it. | `Open log`, `Restore`, `Delete`, `Forget` |

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
- `purge` is the real delete, and it is what the `Delete` button calls. It removes
  `<id>.json`, `<id>.log`, `<id>.runner.log`, `<id>.accept.log`, every archived state for
  that id, and the id itself from `tasks.json`, so the card does not come back as a
  fresh `queued` job. Refused while the job is running.
- `forget` is the lighter option: it removes the id from `tasks.json` and leaves the
  state and logs in place. Use it when you want the card gone but the evidence kept.

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

Removal never deletes anything. `Delete` is the destructive action: it deletes the job
and its place in the task list, and it asks first with the exact consequence. `Forget`
drops only the definition and keeps the files, for the case where you want the card gone
but the logs kept.

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
