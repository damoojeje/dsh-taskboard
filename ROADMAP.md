# Roadmap

A working review of the plugin: what it does now, what would make it better, and what
is technically weak. Ordered by value per unit of effort. Nothing here is committed
until it lands in a release.

## Shipped

| Version | Capability |
|---|---|
| 0.1 | Board with phase, elapsed, token budget, branch, last commit, acceptance |
| 0.2 | Live log tail, start, stop, restart, with confirmations and guards |
| 0.3 | Remove as archive, show removed, restore |
| 0.4.1 | Real delete (purge removes the job and its definition), forget, tests, CI, project layout |

## Shipped in 0.5.0

| Capability | Note |
|---|---|
| Filter and sections | Text filter over id, title, branch, phase. Active and Finished, Finished collapsible. |
| Staleness warning | A running job whose state file is older than ten minutes says so on the card. |
| Rate and estimate | Tokens per minute over a ten minute window, and an estimate to the cap. |
| Copy actions | Copy the branch, or the log tail while it is open. |
| Persisted state | Filter, show removed, finished collapsed, open log and the notification choice survive a refresh. |
| Visibility pause | The stream and the log poll stop while the tab is hidden and resume on return. |
| Batch actions | Stop all running, archive every finished job, one confirmation each. |
| Retention | `TASKBOARD_RETENTION_DAYS` prunes archives on host load. |
| Keyboard | `Escape` closes a confirmation first, then the log. |
| Push | Server sent events at `/api/taskboard/events`, polling as the fallback. |
| Chain context | A child card names its parent and the parent phase. |
| Delete any phase | Queued, blocked, stalled, finished or running; a running job is stopped first. |
| Notes | A per job note thread, removed with the job. |
| Metrics | Jobs, pass and fail counts, tokens and cache share. |
| Log controls | Search, tail size, follow, download, and PASS or FAIL tones. |

## Next

Nothing here is urgent. These need a product decision rather than code.

1. **Restart with a different cap.** The runner reads caps from the task list, so a one
   off override needs a runner change, not a panel change. Decide whether the panel may
   write a per run cap and how the runner reads it.
2. **Multi host.** Aggregating a feed from more than one machine changes the threat
   model, so it needs an explicit setting and a review of what an exposed route means.
3. **Portable process control.** `/proc` and POSIX signals are Linux only. The board and
   log already work everywhere; the actions need a platform adapter, tested on a real
   macOS and Windows host before it ships.
4. **Locale.** Labels are English strings. Adopt the Harness locale service once the
   interface stabilises.

## Later

- **Desktop notification polish.** Today it fires when the panel is open and permission
  is granted. A background delivery path would need the host to know where to send it.

## Technical debt

- **State write cadence.** The panel cannot be fresher than the runner's writes. The
  staleness warning is the honest fix; anything else invents data.
- **Loopback assumption.** Routes are owner gated, but the panel assumes the Web server
  is not exposed. Beyond loopback needs a review, not a toggle.
- **pid identity uses clock ticks.** The start time comparison assumes a 100 Hz clock,
  true on Linux. A platform adapter would carry its own rule.
- **Rate is memory only.** Samples reset when the host restarts, so the first minutes
  after a reload show no rate. Persisting them is not worth a file.
- **Snapshot cost.** Every snapshot stats files and reads `/proc` per task. Fine for tens
  of tasks; a hundred would want a cache.

## How to pick

| If you want | Do this |
|---|---|
| A calmer board on a busy day | Filter, sections, persisted state |
| To trust the numbers | Staleness warning, rate and estimate |
| To save time at the desk | Copy actions, keyboard polish, batch stop |
| To keep the host tidy | Retention policy, prune all finished |
| A bigger architectural win | Push instead of poll |
