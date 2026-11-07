# Contributing

Small project, short rules. If you are changing the panel, read
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first.

## Setup

```bash
git clone https://github.com/damoojeje/dsh-taskboard.git
cd dsh-taskboard
npm install
```

`npm install` fetches esbuild, which is the only build dependency. React is not a
dependency: the browser bundle keeps it external and the Harness page provides it.

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Bundles `src/client/index.jsx` into `lib/client.js` and wraps it for the module loader. |
| `npm test` | Runs the host and bundle smoke test against temporary directories. |
| `npm run smoke` | Same as `npm test`. |

Run `npm test` before every commit. Run `npm run build` and commit the resulting
`lib/client.js` whenever you touch `src/client`. CI fails when the committed bundle does
not match the source.

## Style

- No em dash, no en dash, no spaced hyphen joining clauses. Use a comma, a colon, a
  semicolon, a period, or rewrite the sentence.
- No emoji anywhere, in code, comments, docs or commit messages.
- Two spaces of indentation, single quotes in JavaScript, semicolons.
- Comments explain why, not what.
- Author is the contributor only. Do not add co-author trailers or tool watermarks.

## Commits

Conventional commit types, lower case subject, imperative mood:

```
feat: add a filter to the dispatch board
fix: keep the removed chip after a restore
docs: explain the archive layout
```

One logical change per commit. Do not mix a rebuild of `lib/client.js` with unrelated
source edits.

## Pull requests

- One topic per pull request.
- `npm test` passes locally.
- The bundle is committed and matches the source.
- A behaviour change updates `docs/` and, when user visible, `CHANGELOG.md`.
- New host actions carry a guard and a smoke check. An action that can destroy data
  needs a confirmation that names what is destroyed.

## Release

1. Update `version` in `package.json` and `CHANGELOG.md`.
2. `npm run build && npm test`.
3. Commit, tag `vX.Y.Z`, push the tag.
