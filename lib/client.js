/* dsh-taskboard client bundle. Built with esbuild; React stays external and
   resolves through the page's shared module table. Do not hand-edit this file;
   edit src/client.jsx and run ./build.sh. */
window.__ModuleLoader__.load({
  id: 'dsh-taskboard',
  factory: function (require) {
    var module = { exports: {} };
    (function (module, exports, require) {
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.jsx
var client_exports = {};
__export(client_exports, {
  TaskIcon: () => TaskIcon,
  TaskPanel: () => TaskPanel,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);
var ID = "dsh-taskboard";
var POLL_MS = 5e3;
var LOG_POLL_MS = 2e3;
var PHASES = {
  running: { label: "running", tone: "#2f9e44" },
  stalled: { label: "runner gone", tone: "#c92a2a" },
  blocked: { label: "blocked", tone: "#e8590c" },
  queued: { label: "queued", tone: "#868e96" },
  capped: { label: "capped", tone: "#c92a2a" },
  failed: { label: "failed", tone: "#c92a2a" },
  done: { label: "done", tone: "#2f9e44" }
};
function pad(value) {
  return String(value).padStart(2, "0");
}
function clock(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function duration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${pad(minutes % 60)}m`;
}
function tokens(value) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(value);
}
var styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    height: "100%",
    overflowY: "auto",
    padding: "16px 16px 24px",
    color: "inherit",
    font: "inherit"
  },
  head: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" },
  title: { margin: 0, fontSize: "14px", fontWeight: 600, letterSpacing: "0.01em" },
  count: { fontSize: "11px", opacity: 0.65, fontVariantNumeric: "tabular-nums" },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px 12px 11px",
    border: "1px solid rgba(128, 128, 128, 0.22)",
    borderLeftWidth: "3px",
    borderLeftStyle: "solid",
    borderRadius: "10px",
    background: "rgba(128, 128, 128, 0.05)"
  },
  row: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  idBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "5px",
    border: "1px solid rgba(128, 128, 128, 0.35)",
    fontSize: "11px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums"
  },
  taskTitle: {
    fontSize: "12.5px",
    fontWeight: 550,
    lineHeight: 1.35,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical"
  },
  phase: {
    fontSize: "10.5px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 600,
    whiteSpace: "nowrap"
  },
  meta: { fontSize: "11px", opacity: 0.72, fontVariantNumeric: "tabular-nums" },
  barTrack: { height: "4px", borderRadius: "999px", background: "rgba(128, 128, 128, 0.22)", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: "999px", opacity: 0.8 },
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "10.5px", opacity: 0.65 },
  accept: { fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" },
  empty: { fontSize: "12px", opacity: 0.65, lineHeight: 1.5 },
  foot: { fontSize: "10.5px", opacity: 0.5, marginTop: "2px" },
  error: { fontSize: "11px", color: "#c92a2a" },
  fresh: { fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2f9e44" },
  button: {
    appearance: "none",
    border: "1px solid rgba(128, 128, 128, 0.35)",
    background: "transparent",
    color: "inherit",
    borderRadius: "7px",
    padding: "3px 9px",
    fontSize: "11px",
    fontWeight: 550,
    cursor: "pointer",
    font: "inherit"
  },
  buttonPrimary: { borderColor: "currentColor", fontWeight: 650 },
  buttonDanger: { borderColor: "#c92a2a", color: "#c92a2a" },
  logBox: {
    margin: 0,
    maxHeight: "220px",
    overflow: "auto",
    padding: "8px 9px",
    borderRadius: "8px",
    background: "rgba(0, 0, 0, 0.22)",
    border: "1px solid rgba(128, 128, 128, 0.18)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "10.5px",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "inherit"
  },
  notice: { fontSize: "11px", lineHeight: 1.4 },
  removedCard: { opacity: 0.62, borderStyle: "dashed" },
  chip: { fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7 }
};
function TaskCard({ task, fresh, open, log, pending, acting, onOpen, onAsk, onConfirm, onCancel }) {
  const phase = PHASES[task.phase] || { label: task.phase, tone: "#868e96" };
  const finished = task.phase === "done" || task.phase === "failed" || task.phase === "capped";
  const percent = task.cap > 0 ? task.percent : 0;
  const verdict = task.accept === "pass" ? "pass" : task.accept === "fail" ? "fail" : null;
  const canStart = !task.running && task.phase !== "running";
  const logRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [open, log.text]);
  return /* @__PURE__ */ import_react.default.createElement("div", { style: { ...styles.card, borderLeftColor: phase.tone, ...task.removed ? styles.removedCard : null }, role: "listitem" }, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.idBadge }, task.id), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.taskTitle }, task.title), fresh ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.fresh }, "new") : null, task.removed ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.chip }, "removed") : null), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, /* @__PURE__ */ import_react.default.createElement("span", { style: { ...styles.phase, color: phase.tone } }, phase.label), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, finished ? `finished ${clock(task.finished)}` : task.started ? clock(task.started) : "not started"), task.elapsedS != null ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, duration(task.elapsedS), task.wallS ? ` of ${duration(task.wallS)}` : "") : null, task.chainFrom ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, "after ", task.chainFrom) : null), task.cap > 0 ? /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } }, /* @__PURE__ */ import_react.default.createElement(
    "div",
    {
      style: styles.barTrack,
      role: "progressbar",
      "aria-valuenow": percent,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-label": `${task.id} token budget used`
    },
    /* @__PURE__ */ import_react.default.createElement("div", { style: { ...styles.barFill, width: `${Math.max(percent, 1)}%`, background: phase.tone } })
  ), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, tokens(task.used), " of ", tokens(task.cap), " tokens (", percent, "%)", task.cacheRead ? `, cache ${tokens(task.cacheRead)}` : "")) : null, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, task.branch ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.mono }, task.branch) : null, task.lastCommit ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.mono }, task.lastCommit) : null, verdict ? /* @__PURE__ */ import_react.default.createElement("span", { style: { ...styles.accept, color: verdict === "pass" ? "#2f9e44" : "#c92a2a" } }, "accept ", verdict) : null), task.note ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, task.note) : null, task.killed ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.error }, "killed: ", task.killed) : null, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      style: { ...styles.button, opacity: acting ? 0.5 : 1 },
      onClick: () => onOpen(task.id),
      "aria-expanded": open,
      "aria-controls": `taskboard-log-${task.id}`
    },
    open ? "Hide log" : "Open log"
  ), task.removed ? /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      style: { ...styles.button, ...styles.buttonPrimary, opacity: acting ? 0.5 : 1 },
      onClick: () => onAsk(task.id, "restore"),
      disabled: acting
    },
    "Restore"
  ) : canStart ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      style: { ...styles.button, ...styles.buttonPrimary, opacity: acting ? 0.5 : 1 },
      onClick: () => onAsk(task.id, "start"),
      disabled: acting
    },
    "Start"
  ), task.removable ? /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      style: { ...styles.button, opacity: acting ? 0.5 : 1 },
      onClick: () => onAsk(task.id, "remove"),
      disabled: acting
    },
    "Remove"
  ) : null) : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      style: { ...styles.button, opacity: acting ? 0.5 : 1 },
      onClick: () => onAsk(task.id, "restart"),
      disabled: acting
    },
    "Restart"
  ), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      style: { ...styles.button, ...styles.buttonDanger, opacity: acting ? 0.5 : 1 },
      onClick: () => onAsk(task.id, "stop"),
      disabled: acting
    },
    "Stop"
  ))), pending && pending.id === task.id ? /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row, role: "alertdialog", "aria-label": `Confirm ${pending.action} ${task.id}` }, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, pending.action, " ", task.id, "? ", pending.action === "stop" ? "The agent is terminated." : pending.action === "remove" ? "Its state is archived and hidden; the task definition and logs stay." : pending.action === "restore" ? "It comes back on the board with its last archived state." : `It runs against a ${tokens(task.cap)} token cap.`), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", style: { ...styles.button, ...styles.buttonPrimary }, onClick: () => onConfirm(task.id, pending.action) }, "Yes, ", pending.action), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", style: styles.button, onClick: onCancel }, "Cancel")) : null, task.notice ? /* @__PURE__ */ import_react.default.createElement("span", { style: { ...styles.notice, color: task.notice.ok ? "#2f9e44" : "#c92a2a" } }, task.notice.text) : null, open ? /* @__PURE__ */ import_react.default.createElement("div", { id: `taskboard-log-${task.id}` }, log.missing ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, "No log yet. The runner writes one once the agent starts.") : /* @__PURE__ */ import_react.default.createElement("pre", { style: styles.logBox, ref: logRef }, log.text || "empty"), log.truncated ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, "Showing the tail only.") : null) : null);
}
function TaskPanel() {
  const [state, setState] = (0, import_react.useState)({ tasks: [], running: 0, updatedAt: null, error: null });
  const [freshIds, setFreshIds] = (0, import_react.useState)([]);
  const [openId, setOpenId] = (0, import_react.useState)(null);
  const [log, setLog] = (0, import_react.useState)({ text: "", truncated: false, missing: false });
  const [pending, setPending] = (0, import_react.useState)(null);
  const [acting, setActing] = (0, import_react.useState)(false);
  const [notices, setNotices] = (0, import_react.useState)({});
  const [showRemoved, setShowRemoved] = (0, import_react.useState)(false);
  const previous = (0, import_react.useRef)({});
  const loadRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    let alive = true;
    let timer = 0;
    const load = async () => {
      try {
        const response = await fetch(`/api/taskboard/state${showRemoved ? "?removed=1" : ""}`, {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!alive) return;
        const next = {};
        const fresh = [];
        for (const task of data.tasks || []) {
          next[task.id] = task.phase;
          const before = previous.current[task.id];
          if (before && before !== task.phase && task.phase !== "running" && task.phase !== "queued") fresh.push(task.id);
        }
        previous.current = next;
        if (fresh.length > 0) {
          setFreshIds((current) => Array.from(/* @__PURE__ */ new Set([...current, ...fresh])));
          window.setTimeout(() => {
            if (alive) setFreshIds((current) => current.filter((id) => !fresh.includes(id)));
          }, 12e4);
        }
        setState({
          tasks: data.tasks || [],
          running: data.running || 0,
          removedCount: data.removedCount || 0,
          updatedAt: data.updatedAt || null,
          error: null
        });
      } catch (error) {
        if (alive) setState((current) => ({ ...current, error: String(error && error.message || error) }));
      }
    };
    loadRef.current = load;
    load();
    timer = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [showRemoved]);
  (0, import_react.useEffect)(() => {
    if (!openId) return void 0;
    let alive = true;
    const loadLog = async () => {
      try {
        const response = await fetch(`/api/taskboard/log?id=${encodeURIComponent(openId)}&lines=200`, {
          credentials: "same-origin",
          cache: "no-store"
        });
        const data = await response.json();
        if (alive) setLog({ text: data.text || "", truncated: !!data.truncated, missing: !!data.missing });
      } catch {
        if (alive) setLog({ text: "", truncated: false, missing: false });
      }
    };
    loadLog();
    const timer = window.setInterval(loadLog, LOG_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [openId]);
  const send = async (id, action) => {
    setActing(true);
    setPending(null);
    try {
      const response = await fetch("/api/taskboard/action", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-taskboard": "1" },
        body: JSON.stringify({ id, action })
      });
      const data = await response.json();
      setNotices((current) => ({
        ...current,
        [id]: { ok: !!data.ok, text: data.message || (data.ok ? "done" : "refused") }
      }));
      window.setTimeout(() => {
        setNotices((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      }, 8e3);
      if (loadRef.current) loadRef.current();
    } catch (error) {
      setNotices((current) => ({ ...current, [id]: { ok: false, text: String(error && error.message || error) } }));
    } finally {
      setActing(false);
    }
  };
  const tasks = (state.tasks || []).map((task) => ({
    ...task,
    notice: notices[task.id]
  }));
  return /* @__PURE__ */ import_react.default.createElement("div", { style: styles.wrap }, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.head }, /* @__PURE__ */ import_react.default.createElement("h2", { style: styles.title }, "Dispatches"), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.count }, state.running, " running of ", tasks.length)), state.removedCount ? /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      style: styles.button,
      onClick: () => setShowRemoved((current) => !current),
      "aria-pressed": showRemoved
    },
    showRemoved ? "Hide removed" : `Show removed (${state.removedCount})`
  )) : null, state.error ? /* @__PURE__ */ import_react.default.createElement("div", { style: styles.error }, "status unavailable: ", state.error) : null, /* @__PURE__ */ import_react.default.createElement("div", { role: "list", "aria-live": "polite", "aria-label": "Headless dispatch status", style: { display: "flex", flexDirection: "column", gap: "8px" } }, tasks.map((task) => /* @__PURE__ */ import_react.default.createElement(
    TaskCard,
    {
      key: task.id,
      task,
      fresh: freshIds.includes(task.id),
      open: openId === task.id,
      log,
      pending,
      acting,
      onOpen: (id) => setOpenId((current) => current === id ? null : id),
      onAsk: (id, action) => setPending({ id, action }),
      onConfirm: (id, action) => send(id, action),
      onCancel: () => setPending(null)
    }
  ))), tasks.length === 0 && !state.error ? /* @__PURE__ */ import_react.default.createElement("p", { style: styles.empty }, "No dispatches are registered. When a headless task starts, its state appears here within a few seconds.") : null, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.foot }, state.updatedAt ? `updated ${clock(state.updatedAt)}` : "waiting for the host", " \xB7 polled every ", POLL_MS / 1e3, "s"));
}
function TaskIcon({ size }) {
  const edge = typeof size === "number" ? size : 16;
  return /* @__PURE__ */ import_react.default.createElement("svg", { width: edge, height: edge, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", "aria-hidden": "true" }, /* @__PURE__ */ import_react.default.createElement("rect", { x: "2.2", y: "3", width: "11.6", height: "3.2", rx: "1.1" }), /* @__PURE__ */ import_react.default.createElement("rect", { x: "2.2", y: "7.6", width: "11.6", height: "2.2", rx: "1", opacity: "0.7" }), /* @__PURE__ */ import_react.default.createElement("rect", { x: "2.2", y: "11.2", width: "7.6", height: "2", rx: "1", opacity: "0.45" }));
}
var name = ID;
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: ID }, TaskPanel));
  ctx.slots.inject(
    "sidebar.panellist",
    () => ctx.slots.register({ name: "sidebar.panellist", id: ID, order: 30, label: "Dispatches" }, TaskIcon)
  );
}

    })(module, module.exports, require);
    return module.exports;
  },
});
