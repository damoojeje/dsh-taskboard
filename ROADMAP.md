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

## Next

1. **Filter and sections.** Split the board into Active and Finished, collapse Finished
   by default, and add a text filter over id, title and branch. Twenty cards are already
   hard to scan, and a board that holds a day of dispatches will be worse. Effort: small.
2. **Staleness warning.** The runner writes the state file on its own cadence. When a
   job is `running` and the state file has not changed for, say, ten minutes, the card
   should say "no runner update in 12m", because that is what a hung agent looks like
   before you notice the token line has stopped. Effort: small.
3. **Rate and estimate.** Tokens per minute over the last interval, an estimate of time
   to the token cap, and the wall clock remaining. The percentage alone hides whether a
   job is moving. Effort: small, needs two samples kept in the panel.
4. **Copy actions.** Copy the last 50 log lines, the branch, or the worktree path. A log
   that cannot be pasted elsewhere is half useful. Effort: small.
5. **Persisted panel state.** Remember the open log and the show removed toggle in
   `localStorage`, so a refresh does not reset the view. Effort: small.
6. **Poll when hidden only.** Pause the five second poll while `document.hidden`, refresh
   once on visibility change. This is battery and, on a busy host, real work. Effort:
   small.
7. **Batch actions.** Stop all running, and prune every finished card, with one
   confirmation that names the count. Effort: medium, mostly care around partial failure.
8. **Retention policy.** An optional setting to purge archives older than N days, run on
   host load. Keeps `archive/` from growing without bound. Effort: small.
9. **Escape and focus.** `Escape` closes a confirmation or the log, focus returns to the
   button that opened it. Accessibility polish. Effort: small.

## Later

- **Push instead of poll.** The connection already carries streams. A subscription to
  state changes would cut the poll to zero and show transitions instantly. Effort:
  medium, needs a host stream and lifecycle care.
- **Chain view.** Tasks declare `chain_from`. The panel could draw the chain and say
  which parent blocks a child, instead of one line of text. Effort: medium.
- **Desktop notification** when a job finishes, opt in, one permission prompt.
- **Restart with a different cap.** Today a restart uses the cap in `tasks.json`. A small
  dialog could pass a one off cap, written into the state file only.
- **Multi host.** Read an aggregate feed from more than one machine. This changes the
  threat model, so it belongs behind an explicit setting.
- **Windows and macOS.** Process control uses `/proc` and POSIX signals. A platform
  adapter over `taskkill` and `ps` would make the actions portable. The board and log
  already work everywhere.

## Technical debt

- **pid reuse.** Liveness is `kill(pid, 0)`. A recycled pid can briefly make a dead job
  look alive. Store the process start time from `/proc/<pid>/stat` and compare it.
- **Tail by whole file read.** The log route reads up to 512 KiB and slices. For very
  large logs a reverse read is cheaper. Not urgent at dispatch scale.
- **Task list trust.** `tasks.json` is parsed without validation. A malformed file gives
  an empty board rather than an error. A small schema check with a clear message would
  help.
- **State write cadence.** The panel cannot be fresher than the runner's writes. The
  staleness warning is the honest fix; anything else invents data.
- **Loopback assumption.** The routes are owner gated by the connection, but the panel
  assumes the Web server is not exposed. Beyond loopback needs a review, not a toggle.
- **Locale.** Labels are English strings. The Harness client has a locale service; using
  it would be a small refactor once the interface stabilises.

## How to pick

| If you want | Do this |
|---|---|
| A calmer board on a busy day | Filter, sections, persisted state |
| To trust the numbers | Staleness warning, rate and estimate |
| To save time at the desk | Copy actions, keyboard polish, batch stop |
| To keep the host tidy | Retention policy, prune all finished |
| A bigger architectural win | Push instead of poll |
