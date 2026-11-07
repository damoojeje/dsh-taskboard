# Architecture

The plugin has two halves, loaded by different parts of the Harness.

```
package.json  dsh.bundle.patch   -> cordis.patch.yml -> host row  -> lib/index.js
              dsh.client         -> lib/client.js    -> browser    -> sidebar slots
```

## Host half

`lib/index.js` is an ordinary Cordis plugin: `name`, `inject: ['connection']`, and
`apply(ctx)`. It registers three exact fetch routes on the connection's `/api` handler
and reads the dispatch files. It keeps no state of its own beyond the archive and
`dismissed.json`.

Reads on every snapshot, in order:

1. the task list, for ids, titles, branches and caps;
2. one `<id>.json` per id, for phase, pid, timestamps, tokens and acceptance;
3. `dismissed.json`, to decide which cards are hidden.

It writes only for `remove` and `restore`: a state file moves into `archive/`, and
`dismissed.json` records or drops the id. The write is atomic: a temporary file in the
same directory, then a rename.

Process control uses `/proc`: a pid is alive when `kill(pid, 0)` succeeds, and a stop
walks `/proc/<pid>/stat` to build the descendant tree before signalling. That tree
matters because a dispatch is a runner that starts a route wrapper that starts the
agent; killing the runner alone would orphan the agent.

## Client half

`src/client.jsx` is bundled by esbuild into a CommonJS factory, then wrapped in the
module loader call the page expects:

```js
window.__ModuleLoader__.load({
  id: 'dsh-taskboard',
  factory: function (require) {
    var module = { exports: {} };
    (function (module, exports, require) { /* esbuild output */ })(module, module.exports, require);
    return module.exports;
  },
});
```

The factory returns `{ name, inject: ['slots'], apply }`. `apply` registers two slots:

- `sidebar.panellist`: id `dsh-taskboard`, order 30, label `Dispatches`, and an SVG icon.
- `main`: key `dsh-taskboard`, the panel component.

React is external. It resolves through the page's frozen module table, which is why
hooks and event handling work inside the host renderer. Bundling a private copy of React
would break `useState`, because the hooks would talk to a dispatcher the host renderer
does not own.

The panel keeps four pieces of state: the snapshot, the set of ids that changed phase
recently, the id whose log is open, and a pending confirmation. It polls the snapshot
every five seconds and the log every two.

## Data flow

```
tasks.json + <id>.json + dismissed.json
        |
   GET /api/taskboard/state          (snapshot, filtered by ?removed)
        |
   panel render                      (cards, actions, confirmation)
        |
   POST /api/taskboard/action {id, action}
        |
   spawn python3 dsh-run.py <id>     or signal the process tree
```

The plugin never edits a state file that describes a running job, never fakes a phase,
and never invents a command. The runner remains the only writer of dispatch state.

## Guard rails

- The routes are exact paths under `/api`; the connection admits only the owner peer.
- Mutating calls need `x-taskboard: 1`, which cross-site JavaScript cannot set without a
  preflight the API fence refuses.
- Ids must match the declared task list; anything else is a 400.
- `start` refuses when the declared pid is alive.
- `remove` refuses when the job is live or its phase is not finished.
- `stop` signals the whole tree, not just the runner.

## Limits

- Start, stop and restart are Linux only, because they rely on `/proc` and signals.
- The panel trusts the pid in the state file. A pid that the kernel reuses between polls
  can briefly report a dead job as alive; the next state write corrects it.
- Token figures come from the state file, so their granularity is the writer's update
  interval, not the panel's poll.
- The log viewer shows a tail window of at most 512 KiB and 200 lines by default.
- No authentication is added beyond the connection's owner check. Do not expose the Web
  server beyond loopback or a trusted proxy.

## Repository layout

```
package.json          plugin manifest: bundle patch, client declaration, scripts
cordis.patch.yml      inserts the host row
lib/index.js          host half (shipped, no build needed)
lib/client.js         built client bundle (shipped)
src/client.jsx        client source
build.sh              esbuild plus scripts/wrap.cjs
scripts/wrap.cjs      CommonJS to module-loader factory
scripts/smoke.mjs     host routes and bundle registration, temp dirs only
docs/                 this file and USAGE.md
```
