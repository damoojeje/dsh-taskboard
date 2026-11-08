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

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  TaskIcon: () => TaskIcon,
  TaskPanel: () => TaskPanel,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"), 1);
var ID = "dsh-taskboard";
var POLL_MS = 5e3;
var LOG_POLL_MS = 2e3;
var PREFIX = "dsh-taskboard:";
var PHASES = {
  running: { label: "running", tone: "#2f9e44" },
  stalled: { label: "runner gone", tone: "#c92a2a" },
  blocked: { label: "blocked", tone: "#e8590c" },
  queued: { label: "queued", tone: "#868e96" },
  capped: { label: "capped", tone: "#c92a2a" },
  failed: { label: "failed", tone: "#c92a2a" },
  done: { label: "done", tone: "#2f9e44" }
};
var ACTIVE_PHASES = ["running", "stalled", "blocked", "queued"];
function readPref(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
  }
}
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
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
var styles = {
  wrap: { display: "flex", flexDirection: "column", gap: "10px", height: "100%", overflowY: "auto", padding: "16px 16px 24px", color: "inherit", font: "inherit" },
  head: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" },
  title: { margin: 0, fontSize: "14px", fontWeight: 600, letterSpacing: "0.01em" },
  count: { fontSize: "11px", opacity: 0.65, fontVariantNumeric: "tabular-nums" },
  controls: { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" },
  input: { flex: "1 1 140px", minWidth: "120px", padding: "5px 8px", borderRadius: "7px", border: "1px solid rgba(128, 128, 128, 0.35)", background: "transparent", color: "inherit", font: "inherit", fontSize: "12px" },
  section: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", marginTop: "4px" },
  sectionTitle: { margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6 },
  card: { display: "flex", flexDirection: "column", gap: "8px", padding: "12px 12px 11px", border: "1px solid rgba(128, 128, 128, 0.22)", borderLeftWidth: "3px", borderLeftStyle: "solid", borderRadius: "10px", background: "rgba(128, 128, 128, 0.05)" },
  row: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  idBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "18px", height: "18px", padding: "0 5px", borderRadius: "5px", border: "1px solid rgba(128, 128, 128, 0.35)", fontSize: "11px", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  taskTitle: { fontSize: "12.5px", fontWeight: 550, lineHeight: 1.35, flex: 1, minWidth: 0 },
  phase: { fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap" },
  meta: { fontSize: "11px", opacity: 0.72, fontVariantNumeric: "tabular-nums" },
  warm: { fontSize: "11px", color: "#e8590c", fontWeight: 600 },
  barTrack: { height: "4px", borderRadius: "999px", background: "rgba(128, 128, 128, 0.22)", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: "999px", opacity: 0.8 },
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "10.5px", opacity: 0.65 },
  accept: { fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" },
  empty: { fontSize: "12px", opacity: 0.65, lineHeight: 1.5 },
  foot: { fontSize: "10.5px", opacity: 0.5, marginTop: "2px" },
  error: { fontSize: "11px", color: "#c92a2a" },
  fresh: { fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2f9e44" },
  chip: { fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7 },
  removedCard: { opacity: 0.62, borderStyle: "dashed" },
  button: { appearance: "none", border: "1px solid rgba(128, 128, 128, 0.35)", background: "transparent", color: "inherit", borderRadius: "7px", padding: "3px 9px", fontSize: "11px", fontWeight: 550, cursor: "pointer", font: "inherit" },
  buttonPrimary: { borderColor: "currentColor", fontWeight: 650 },
  buttonDanger: { borderColor: "#c92a2a", color: "#c92a2a" },
  logBox: { margin: 0, maxHeight: "320px", overflow: "auto", padding: "8px 9px", borderRadius: "8px", background: "rgba(0, 0, 0, 0.22)", border: "1px solid rgba(128, 128, 128, 0.18)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "10.5px", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "inherit" },
  notice: { fontSize: "11px", lineHeight: 1.4 },
  banner: { fontSize: "11px", lineHeight: 1.4, color: "#e8590c" },
  summary: { display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "11px", opacity: 0.72, fontVariantNumeric: "tabular-nums" },
  summaryItem: { whiteSpace: "nowrap" },
  logTools: { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" },
  logSearch: { flex: "1 1 120px", minWidth: "100px", padding: "3px 7px", borderRadius: "6px", border: "1px solid rgba(128, 128, 128, 0.35)", background: "transparent", color: "inherit", font: "inherit", fontSize: "11px" },
  logLine: { whiteSpace: "pre-wrap", wordBreak: "break-word" },
  notes: { display: "flex", flexDirection: "column", gap: "6px", padding: "8px 9px", borderRadius: "8px", border: "1px solid rgba(128, 128, 128, 0.18)", background: "rgba(128, 128, 128, 0.04)" },
  noteLine: { fontSize: "11px", lineHeight: 1.45, whiteSpace: "pre-wrap" },
  noteArea: { width: "100%", minHeight: "48px", resize: "vertical", padding: "6px 8px", borderRadius: "7px", border: "1px solid rgba(128, 128, 128, 0.35)", background: "transparent", color: "inherit", font: "inherit", fontSize: "11.5px" }
};
function ActionButton({ label, onClick, disabled, tone }) {
  const extra = tone === "primary" ? styles.buttonPrimary : tone === "danger" ? styles.buttonDanger : null;
  return /* @__PURE__ */ import_react.default.createElement("button", { type: "button", style: { ...styles.button, ...extra || null, opacity: disabled ? 0.5 : 1 }, onClick, disabled }, label);
}
function logLinesOf(text, query) {
  const lines = (text || "").split("\n");
  const needle = (query || "").trim().toLowerCase();
  const filtered = needle ? lines.filter((line) => line.toLowerCase().includes(needle)) : lines;
  return filtered.slice(-2e3);
}
function logTone(line) {
  if (/FAIL|error|Error|refused|Exception/.test(line)) return "#c92a2a";
  if (/PASS/.test(line)) return "#2f9e44";
  return void 0;
}
function TaskCard({ task, fresh, open, log, pending, acting, onOpen, onAsk, onConfirm, onCancel, onCopy, logLines, setLogLines }) {
  const phase = PHASES[task.phase] || { label: task.phase, tone: "#868e96" };
  const finished = task.phase === "done" || task.phase === "failed" || task.phase === "capped";
  const percent = task.cap > 0 ? task.percent : 0;
  const verdict = task.accept === "pass" ? "pass" : task.accept === "fail" ? "fail" : null;
  const canStart = !task.running && task.phase !== "running";
  const logRef = (0, import_react.useRef)(null);
  const [notesOpen, setNotesOpen] = (0, import_react.useState)(false);
  const [notes, setNotes] = (0, import_react.useState)([]);
  const [noteText, setNoteText] = (0, import_react.useState)("");
  const [noteBusy, setNoteBusy] = (0, import_react.useState)(false);
  const [logQuery, setLogQuery] = (0, import_react.useState)("");
  const [follow, setFollow] = (0, import_react.useState)(true);
  (0, import_react.useEffect)(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [open, log.text]);
  const scrolledRef = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    if (!open) {
      scrolledRef.current = false;
      return;
    }
    if (log.text && !scrolledRef.current && logRef.current) {
      logRef.current.scrollIntoView({ block: "nearest" });
      scrolledRef.current = true;
    }
  }, [open, log.text]);
  (0, import_react.useEffect)(() => {
    if (open && follow && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [open, follow, log.text]);
  const loadNotes = async () => {
    try {
      const response = await fetch(`/api/taskboard/notes?id=${encodeURIComponent(task.id)}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch {
      setNotes([]);
    }
  };
  (0, import_react.useEffect)(() => {
    if (notesOpen) loadNotes();
  }, [notesOpen]);
  const saveNote = async () => {
    const text = noteText.trim();
    if (!text || noteBusy) return;
    setNoteBusy(true);
    try {
      await fetch("/api/taskboard/notes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-taskboard": "1" },
        body: JSON.stringify({ id: task.id, text })
      });
      setNoteText("");
      await loadNotes();
    } finally {
      setNoteBusy(false);
    }
  };
  const downloadLog = () => {
    try {
      const blob = new Blob([log.text || ""], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${task.id}.log`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
    }
  };
  const confirmation = (() => {
    if (!pending) return "";
    if (pending.action === "stop") return "The agent is terminated.";
    if (pending.action === "remove") return "Its state is archived and hidden; the task definition and logs stay.";
    if (pending.action === "purge") return task.running ? "Stops the agent, then deletes the job for good: state, archive, logs and its place in the task list. Cannot be undone." : "Deletes the job for good: state, archive, logs and its place in the task list. Cannot be undone.";
    if (pending.action === "forget") return "Drops the task definition; logs stay unless you delete first.";
    if (pending.action === "restore") return "It comes back on the board with its last archived state.";
    return `It runs against a ${tokens(task.cap)} token cap.`;
  })();
  return /* @__PURE__ */ import_react.default.createElement("div", { style: { ...styles.card, borderLeftColor: phase.tone, ...task.removed ? styles.removedCard : null }, role: "listitem" }, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.idBadge }, task.id), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.taskTitle }, task.title), fresh ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.fresh }, "new") : null, task.removed ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.chip }, "removed") : null), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, /* @__PURE__ */ import_react.default.createElement("span", { style: { ...styles.phase, color: phase.tone } }, phase.label), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, finished ? `finished ${clock(task.finished)}` : task.started ? clock(task.started) : "not started"), task.elapsedS != null ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, duration(task.elapsedS), task.wallS ? ` of ${duration(task.wallS)}` : "") : null, task.stale ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.warm }, "no runner update in ", duration(task.stateAgeS || 0)) : null, task.parent ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, "after ", task.parent.id, " (", task.parent.phase, ")") : null), task.cap > 0 ? /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } }, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.barTrack, role: "progressbar", "aria-valuenow": percent, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `${task.id} token budget used` }, /* @__PURE__ */ import_react.default.createElement("div", { style: { ...styles.barFill, width: `${Math.max(percent, 1)}%`, background: phase.tone } })), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, tokens(task.used), " of ", tokens(task.cap), " tokens (", percent, "%)", task.tokensPerMinute ? `, ${tokens(task.tokensPerMinute)}/min` : "", task.etaSeconds ? `, about ${duration(task.etaSeconds)} to cap` : "", task.cacheRead ? `, cache ${tokens(task.cacheRead)}` : "")) : null, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, task.branch ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.mono }, task.branch) : null, task.lastCommit ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.mono }, task.lastCommit) : null, verdict ? /* @__PURE__ */ import_react.default.createElement("span", { style: { ...styles.accept, color: verdict === "pass" ? "#2f9e44" : "#c92a2a" } }, "accept ", verdict) : null), task.note ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, task.note) : null, task.killed ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.error }, "killed: ", task.killed) : null, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: open ? "Hide log" : "Open log", onClick: () => onOpen(task.id) }), task.removed ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Restore", tone: "primary", onClick: () => onAsk(task.id, "restore"), disabled: acting }), /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Delete", tone: "danger", onClick: () => onAsk(task.id, "purge"), disabled: acting }), /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Forget", onClick: () => onAsk(task.id, "forget"), disabled: acting })) : canStart ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Start", tone: "primary", onClick: () => onAsk(task.id, "start"), disabled: acting }), task.removable ? /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Remove", onClick: () => onAsk(task.id, "remove"), disabled: acting }) : null) : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Restart", onClick: () => onAsk(task.id, "restart"), disabled: acting }), /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Stop", tone: "danger", onClick: () => onAsk(task.id, "stop"), disabled: acting })), !task.removed ? /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Delete", tone: "danger", onClick: () => onAsk(task.id, "purge"), disabled: acting }) : null, /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: notesOpen ? "Hide notes" : `Notes${notes.length ? ` (${notes.length})` : ""}`, onClick: () => setNotesOpen((value) => !value) }), task.branch ? /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Copy branch", onClick: () => onCopy(task.branch) }) : null, open ? /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Copy log", onClick: () => onCopy(log.text) }) : null), pending && pending.id === task.id ? /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row, role: "alertdialog", "aria-label": `Confirm ${pending.action} ${task.id}` }, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, pending.action, " ", task.id, "? ", confirmation), /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: `Yes, ${pending.action}`, tone: pending.action === "purge" || pending.action === "forget" || pending.action === "stop" ? "danger" : "primary", onClick: () => onConfirm(task.id, pending.action) }), /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Cancel", onClick: onCancel })) : null, task.notice ? /* @__PURE__ */ import_react.default.createElement("span", { style: { ...styles.notice, color: task.notice.ok ? "#2f9e44" : "#c92a2a" } }, task.notice.text) : null, open ? /* @__PURE__ */ import_react.default.createElement("div", { id: `taskboard-log-${task.id}`, style: { display: "flex", flexDirection: "column", gap: "6px" } }, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.logTools }, /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      style: styles.logSearch,
      type: "search",
      placeholder: "Search the log",
      value: logQuery,
      onChange: (event) => setLogQuery(event.target.value),
      "aria-label": `Search the ${task.id} log`
    }
  ), /* @__PURE__ */ import_react.default.createElement(
    "select",
    {
      value: logLines,
      onChange: (event) => setLogLines(Number(event.target.value)),
      "aria-label": "Log lines",
      style: { ...styles.button, padding: "3px 6px" }
    },
    /* @__PURE__ */ import_react.default.createElement("option", { value: 200 }, "200 lines"),
    /* @__PURE__ */ import_react.default.createElement("option", { value: 500 }, "500 lines"),
    /* @__PURE__ */ import_react.default.createElement("option", { value: 1e3 }, "1000 lines")
  ), /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: follow ? "Following" : "Follow", onClick: () => setFollow((value) => !value) }), /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Download", onClick: downloadLog })), log.missing ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, "No log yet. The runner writes one once the agent starts.") : /* @__PURE__ */ import_react.default.createElement("div", { style: styles.logBox, ref: logRef, role: "log", "aria-label": `${task.id} log` }, logLinesOf(log.text, logQuery).map((line, index) => /* @__PURE__ */ import_react.default.createElement("div", { key: index, style: { ...styles.logLine, color: logTone(line) } }, line === "" ? " " : line))), log.truncated ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, "Showing the tail only.") : null) : null, notesOpen ? /* @__PURE__ */ import_react.default.createElement("div", { style: styles.notes }, notes.length === 0 ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, "No notes yet. Notes are kept beside the job state.") : null, notes.map((note, index) => /* @__PURE__ */ import_react.default.createElement("span", { style: styles.noteLine, key: `${note.at || "note"}-${index}` }, note.at ? `${clock(note.at)} ` : "", note.text)), /* @__PURE__ */ import_react.default.createElement(
    "textarea",
    {
      style: styles.noteArea,
      placeholder: "Add a note for the next person, or a reminder for yourself",
      value: noteText,
      onChange: (event) => setNoteText(event.target.value),
      "aria-label": `Note for ${task.id}`
    }
  ), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: noteBusy ? "Saving" : "Save note", tone: "primary", onClick: saveNote, disabled: noteBusy || !noteText.trim() }), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, noteText.length, "/2000"))) : null);
}
function TaskPanel() {
  const [snapshot, setSnapshot] = (0, import_react.useState)({ tasks: [], running: 0, removedCount: 0, warnings: [], updatedAt: null });
  const [mode, setMode] = (0, import_react.useState)("connecting");
  const [error, setError] = (0, import_react.useState)(null);
  const [filter, setFilter] = (0, import_react.useState)(() => readPref("filter", ""));
  const [showRemoved, setShowRemoved] = (0, import_react.useState)(() => readPref("showRemoved", false));
  const [finishedOpen, setFinishedOpen] = (0, import_react.useState)(() => readPref("finishedOpen", true));
  const [notify, setNotify] = (0, import_react.useState)(() => readPref("notify", false));
  const [openId, setOpenId] = (0, import_react.useState)(() => readPref("openId", null));
  const [log, setLog] = (0, import_react.useState)({ text: "", truncated: false, missing: false });
  const [logLines, setLogLines] = (0, import_react.useState)(() => readPref("logLines", 200));
  const [pending, setPending] = (0, import_react.useState)(null);
  const [acting, setActing] = (0, import_react.useState)(false);
  const [notices, setNotices] = (0, import_react.useState)({});
  const [freshIds, setFreshIds] = (0, import_react.useState)([]);
  const previous = (0, import_react.useRef)({});
  const lastUpdated = (0, import_react.useRef)(0);
  const notifyRef = (0, import_react.useRef)(notify);
  (0, import_react.useEffect)(() => {
    writePref("filter", filter);
  }, [filter]);
  (0, import_react.useEffect)(() => {
    writePref("showRemoved", showRemoved);
  }, [showRemoved]);
  (0, import_react.useEffect)(() => {
    writePref("finishedOpen", finishedOpen);
  }, [finishedOpen]);
  (0, import_react.useEffect)(() => {
    writePref("notify", notify);
    notifyRef.current = notify;
  }, [notify]);
  (0, import_react.useEffect)(() => {
    writePref("openId", openId);
  }, [openId]);
  (0, import_react.useEffect)(() => {
    writePref("logLines", logLines);
  }, [logLines]);
  (0, import_react.useEffect)(() => {
    let closed = false;
    let timer = null;
    let source = null;
    const apply2 = (data) => {
      if (closed) return;
      const stamp = Date.parse(data.updatedAt || "") || 0;
      if (stamp && stamp < lastUpdated.current) return;
      if (stamp) lastUpdated.current = stamp;
      const next = {};
      const fresh = [];
      for (const task of data.tasks || []) {
        next[task.id] = task.phase;
        const before = previous.current[task.id];
        if (before && before !== task.phase && !ACTIVE_PHASES.includes(task.phase)) {
          fresh.push(task.id);
          if (notifyRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(`Dispatch ${task.id} ${task.phase}`, { body: task.title });
            } catch {
            }
          }
        }
      }
      previous.current = next;
      if (fresh.length > 0) {
        setFreshIds((current) => Array.from(/* @__PURE__ */ new Set([...current, ...fresh])));
        window.setTimeout(() => setFreshIds((current) => current.filter((id) => !fresh.includes(id))), 12e4);
      }
      setSnapshot(data);
      setError(null);
    };
    const poll = async () => {
      try {
        const response = await fetch("/api/taskboard/state?removed=1", { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        apply2(await response.json());
      } catch (err) {
        if (!closed) setError(String(err && err.message || err));
      }
    };
    const startPolling = () => {
      if (closed || timer) return;
      setMode("polling");
      poll();
      timer = window.setInterval(poll, POLL_MS);
    };
    const connect = () => {
      if (closed) return;
      if (document.hidden || typeof window.EventSource !== "function") {
        startPolling();
        return;
      }
      try {
        source = new window.EventSource("/api/taskboard/events");
        source.onopen = () => {
          if (closed) return;
          if (timer) {
            window.clearInterval(timer);
            timer = null;
          }
          setMode("live");
        };
        source.onmessage = (event) => {
          try {
            apply2(JSON.parse(event.data));
            if (!closed) setMode("live");
          } catch {
          }
        };
        source.onerror = () => {
          if (source) {
            source.close();
            source = null;
          }
          startPolling();
        };
      } catch {
        startPolling();
      }
    };
    const stop = () => {
      if (source) {
        source.close();
        source = null;
      }
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const onVisible = () => {
      stop();
      setMode("connecting");
      connect();
    };
    connect();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      closed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  (0, import_react.useEffect)(() => {
    if (!openId) return void 0;
    let active2 = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/taskboard/log?id=${encodeURIComponent(openId)}&lines=${logLines}`, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (active2) setLog({ text: data.text || "", truncated: !!data.truncated, missing: !!data.missing });
      } catch {
        if (active2) setLog({ text: "", truncated: false, missing: false });
      }
    };
    load();
    const timer = window.setInterval(load, LOG_POLL_MS);
    return () => {
      active2 = false;
      window.clearInterval(timer);
    };
  }, [openId, logLines]);
  (0, import_react.useEffect)(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (pending) setPending(null);
      else if (openId) setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, openId]);
  const flash = (key, ok, text) => {
    setNotices((current) => ({ ...current, [key]: { ok, text } }));
    window.setTimeout(() => {
      setNotices((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }, 8e3);
  };
  const send = async (action, id) => {
    setActing(true);
    setPending(null);
    try {
      const response = await fetch("/api/taskboard/action", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-taskboard": "1" },
        body: JSON.stringify({ action, ...id ? { id } : {} })
      });
      const data = await response.json();
      flash(id || action, !!data.ok, data.message || (data.ok ? "done" : "refused"));
    } catch (err) {
      flash(id || action, false, String(err && err.message || err));
    } finally {
      setActing(false);
    }
  };
  const enableNotifications = async () => {
    if (typeof Notification === "undefined") {
      flash("notify", false, "notifications are not available here");
      return;
    }
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotify(true);
      flash("notify", true, "notifications on");
    } else flash("notify", false, "notifications blocked by the browser");
  };
  const tasks = snapshot.tasks || [];
  const query = filter.trim().toLowerCase();
  const filtered = tasks.filter((task) => {
    if (task.removed && !showRemoved) return false;
    if (!query) return true;
    return `${task.id} ${task.title} ${task.branch || ""} ${task.phase}`.toLowerCase().includes(query);
  });
  const active = filtered.filter((task) => ACTIVE_PHASES.includes(task.phase));
  const finished = filtered.filter((task) => !ACTIVE_PHASES.includes(task.phase));
  const runningCount = tasks.filter((task) => task.phase === "running").length;
  const card = (task) => /* @__PURE__ */ import_react.default.createElement(
    TaskCard,
    {
      key: task.id,
      task: { ...task, notice: notices[task.id] },
      fresh: freshIds.includes(task.id),
      open: openId === task.id,
      log,
      pending: pending && pending.id ? pending : null,
      acting,
      onOpen: (id) => setOpenId((current) => current === id ? null : id),
      onAsk: (id, action) => setPending({ id, action }),
      onConfirm: (id, action) => send(action, id),
      onCancel: () => setPending(null),
      onCopy: (text) => copyText(text).then((ok) => {
        if (!ok) flash("copy", false, "copy failed");
      }),
      logLines,
      setLogLines
    }
  );
  return /* @__PURE__ */ import_react.default.createElement("div", { style: styles.wrap }, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.head }, /* @__PURE__ */ import_react.default.createElement("h2", { style: styles.title }, "Dispatches"), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.count }, runningCount, " running of ", filtered.length)), snapshot.metrics ? /* @__PURE__ */ import_react.default.createElement("div", { style: styles.summary }, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.summaryItem }, snapshot.metrics.jobs, " jobs"), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.summaryItem }, snapshot.metrics.acceptPass, " passed"), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.summaryItem }, snapshot.metrics.acceptFail, " failed"), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.summaryItem }, tokens(snapshot.metrics.tokensIn + snapshot.metrics.tokensOut), " tokens"), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.summaryItem }, snapshot.metrics.cacheRead ? `${Math.round(snapshot.metrics.cacheRead / Math.max(1, snapshot.metrics.tokensIn + snapshot.metrics.tokensOut + snapshot.metrics.cacheRead) * 100)}% cache` : "no cache reads")) : null, snapshot.warnings && snapshot.warnings.length > 0 ? /* @__PURE__ */ import_react.default.createElement("span", { style: styles.banner }, snapshot.warnings.join("; ")) : null, error ? /* @__PURE__ */ import_react.default.createElement("div", { style: styles.error }, "status unavailable: ", error) : null, notices.action || notices.copy || notices.notify ? /* @__PURE__ */ import_react.default.createElement("span", { style: { ...styles.notice, color: notices.notify && !notices.notify.ok || notices.copy && !notices.copy.ok ? "#c92a2a" : "#2f9e44" } }, (notices.action || notices.copy || notices.notify).text) : null, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.controls }, /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      style: styles.input,
      type: "search",
      placeholder: "Filter by id, title, branch or phase",
      value: filter,
      onChange: (event) => setFilter(event.target.value),
      "aria-label": "Filter dispatches"
    }
  )), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.controls }, runningCount > 0 ? /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: `Stop all (${runningCount})`, tone: "danger", onClick: () => setPending({ id: null, action: "stop-all" }), disabled: acting }) : null, finished.filter((task) => !task.removed).length > 0 ? /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: `Archive finished (${finished.filter((task) => !task.removed).length})`, onClick: () => setPending({ id: null, action: "prune-finished" }), disabled: acting }) : null, snapshot.removedCount ? /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: showRemoved ? "Hide removed" : `Show removed (${snapshot.removedCount})`, onClick: () => setShowRemoved((value) => !value) }) : null, /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: notify ? "Notifications on" : "Notify me", onClick: enableNotifications })), pending && pending.id === null ? /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row, role: "alertdialog", "aria-label": `Confirm ${pending.action}` }, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.meta }, pending.action === "stop-all" ? `Stop ${runningCount} running job(s)? Each agent is terminated.` : `Archive ${finished.filter((task) => !task.removed).length} finished job(s)? They move to the archive and can be restored.`), /* @__PURE__ */ import_react.default.createElement(
    ActionButton,
    {
      label: `Yes, ${pending.action === "stop-all" ? "stop all" : "archive"}`,
      tone: pending.action === "stop-all" ? "danger" : "primary",
      onClick: () => send(pending.action)
    }
  ), /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: "Cancel", onClick: () => setPending(null) })) : null, active.length > 0 ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.section }, /* @__PURE__ */ import_react.default.createElement("h3", { style: styles.sectionTitle }, "Active"), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.count }, active.length)), /* @__PURE__ */ import_react.default.createElement("div", { role: "list", "aria-live": "polite", "aria-label": "Active dispatches", style: { display: "flex", flexDirection: "column", gap: "8px" } }, active.map(card))) : null, finished.length > 0 ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.section }, /* @__PURE__ */ import_react.default.createElement("h3", { style: styles.sectionTitle }, "Finished"), /* @__PURE__ */ import_react.default.createElement(ActionButton, { label: finishedOpen ? "Hide" : `Show (${finished.length})`, onClick: () => setFinishedOpen((value) => !value) })), finishedOpen ? /* @__PURE__ */ import_react.default.createElement("div", { role: "list", "aria-label": "Finished dispatches", style: { display: "flex", flexDirection: "column", gap: "8px" } }, finished.map(card)) : null) : null, filtered.length === 0 && !error ? /* @__PURE__ */ import_react.default.createElement("p", { style: styles.empty }, tasks.length === 0 ? "No dispatches are registered. When a headless task starts, its state appears here." : "Nothing matches the filter.") : null, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.foot }, snapshot.updatedAt ? `updated ${clock(snapshot.updatedAt)}` : "waiting for the host", " \xB7 ", mode));
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
