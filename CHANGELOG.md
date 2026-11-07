# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

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
