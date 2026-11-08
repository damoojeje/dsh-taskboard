# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.3] 2026-11-08

### Fixed

- A poll response and a live event could cross in flight and the older snapshot could
  land last, so a card could flicker back to the state before an action. Snapshots older
  than the last applied `updatedAt` are ignored.
- Polling kept running after the event stream reconnected. The stream opening now clears
  the poll timer.
- The event stream's interval survived a dropped connection when the stream was not
  cancelled cleanly. It now stops on an abort signal and when enqueue fails, while a
  failed snapshot still leaves the stream open.
- The log view treated any response as content; a server error is now an error state.

### Tests

- The log line parameter is clamped: a 99,999 line request returns at most 1,000 lines.

## [0.6.2] 2026-11-08

### Fixed

- The panel only accepted single-letter task ids, so `G2` and `K1` to `K4` were skipped with
  a warning and never appeared. An id is now a capital letter followed by up to seven
  capital letters or digits, which still cannot escape the state directory.

## [0.6.1] 2026-11-08

### Fixed

- Opening a log on a laptop or a wall display grew the card downward below the fold, so
  the click looked like it did nothing. The log now scrolls into view once its content
  arrives, and the box is taller.

## [0.6.0] 2026-11-07

### Added

- `Delete` works for every phase: a queued or blocked job that never started, a stalled
  one, a finished one, and a running one, which is stopped first. The confirmation says
  which of those it will do.
- Per job notes, stored as `<id>.notes.jsonl` beside the state, with a read and append
  route and a text box in the panel. Notes are removed with the job.
- Board metrics: job count, passed and failed counts, total tokens and cache share.
- Log controls: search the tail, pick 200, 500 or 1000 lines, follow or freeze, download,
  and tone lines containing PASS or FAIL.

### Fixed

- Deleting a queued or blocked job was refused, which left declarations with no state on
  the board with no way to clear them.

## [0.5.0] 2026-11-07

### Added

- Filter over id, title, branch and phase, Active and Finished sections, collapsible.
- Server sent event stream at `/api/taskboard/events`, with polling as the fallback and
  a pause while the tab is hidden.
- Stale warning when a running job has not written its state file for ten minutes.
- Token rate and an estimate to the cap, sampled in memory over a ten minute window.
- Copy branch and copy log, a notification opt in on completion, persisted filter and
  toggles, and `Escape` to close a confirmation or the log.
- Batch actions: stop all running, archive every finished job.
- Optional archive retention through `TASKBOARD_RETENTION_DAYS`.
- Task list validation with visible warnings instead of a silent empty board.
- Process identity check, so a recycled pid does not report a dead job as running.
- Log tail read from the end of the file instead of loading the whole log.

### Changed

- The panel reads one snapshot feed for both the board and the removed jobs, and
  filters locally.

## [0.4.1] 2026-11-07

### Fixed

- `Delete` looked like it only cleared a job: it removed the files but kept the task
  definition, so the card came straight back as a `queued` job. It now removes the
  definition as well, so the card is gone. `Forget` remains the lighter action that
  drops only the definition and keeps the files.
- The Delete confirmation now says exactly that: files, logs and its place in the task
  list, cannot be undone.

## [0.4.0] 2026-11-07

### Added

- `purge`: a real delete for a finished job. Removes its state, archive, agent log,
  runner log and acceptance log. The task definition stays, so the job can run again.
- `forget`: removes the task definition from `tasks.json`, so the id stops appearing on
  the board at all. Logs are untouched unless you purge first.
- `Delete` and `Forget` buttons on an archived card, behind confirmations that spell out
  what is destroyed and warn that it cannot be undone.
- CI workflow: build, verify the committed bundle matches the source, run the smoke test.
- Project layout: `src/host`, `src/client`, `tests`, `docs`, `scripts`.
- `CHANGELOG.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `.editorconfig`.

### Changed

- The host half is loaded from source (`src/host/index.js`) instead of a built copy in
  `lib`, so there is one place to edit and no host build step.
- The smoke test now covers purge and forget, and refuses to purge a running job.

## [0.3.0] 2026-11-07

### Added

- `Remove` for finished jobs: the state is archived under `archive/`, the id is recorded
  in `dismissed.json`, and the card is hidden. Nothing is deleted.
- `Show removed (n)` and `Restore`, which brings the newest archive back and clears the
  dismissal.
- Stalled jobs, where the state says running but the pid is gone, can be removed without
  a stop.

## [0.2.0] 2026-11-06

### Added

- `Open log`: a two second tail of the agent log, scrolled to the end.
- `Start`, `Stop` and `Restart`, each behind a confirmation row that names the token cap.
- Guards: only declared ids, a start is refused while the declared pid lives, and stop
  signals the runner and every process it spawned.

## [0.1.0] 2026-11-06

### Added

- First release. A Dispatches sidebar panel with one card per headless dispatch showing
  phase, elapsed time, token budget, branch, last commit and acceptance verdict.
- Host route `GET /api/taskboard/state`, polling every five seconds.
