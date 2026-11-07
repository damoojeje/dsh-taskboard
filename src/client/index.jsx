// Client half: the Dispatches sidebar panel.
//
// It follows the host through a server sent event stream and falls back to
// polling when the stream is unavailable. It renders one card per dispatch,
// tails the agent log, and drives start, stop, restart, archive, delete and the
// batch actions. Every mutating click asks once with the consequence named.

import React, { useEffect, useRef, useState } from 'react'

const ID = 'dsh-taskboard'
const POLL_MS = 5000
const LOG_POLL_MS = 2000
const PREFIX = 'dsh-taskboard:'

const PHASES = {
  running: { label: 'running', tone: '#2f9e44' },
  stalled: { label: 'runner gone', tone: '#c92a2a' },
  blocked: { label: 'blocked', tone: '#e8590c' },
  queued: { label: 'queued', tone: '#868e96' },
  capped: { label: 'capped', tone: '#c92a2a' },
  failed: { label: 'failed', tone: '#c92a2a' },
  done: { label: 'done', tone: '#2f9e44' },
}

const ACTIVE_PHASES = ['running', 'stalled', 'blocked', 'queued']

function readPref(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writePref(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable; the panel still works.
  }
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function clock(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function duration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${pad(minutes % 60)}m`
}

function tokens(value) {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${Math.round(value / 1e3)}k`
  return String(value)
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflowY: 'auto', padding: '16px 16px 24px', color: 'inherit', font: 'inherit' },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' },
  title: { margin: 0, fontSize: '14px', fontWeight: 600, letterSpacing: '0.01em' },
  count: { fontSize: '11px', opacity: 0.65, fontVariantNumeric: 'tabular-nums' },
  controls: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' },
  input: { flex: '1 1 140px', minWidth: '120px', padding: '5px 8px', borderRadius: '7px', border: '1px solid rgba(128, 128, 128, 0.35)', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: '12px' },
  section: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginTop: '4px' },
  sectionTitle: { margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6 },
  card: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 12px 11px', border: '1px solid rgba(128, 128, 128, 0.22)', borderLeftWidth: '3px', borderLeftStyle: 'solid', borderRadius: '10px', background: 'rgba(128, 128, 128, 0.05)' },
  row: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  idBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '5px', border: '1px solid rgba(128, 128, 128, 0.35)', fontSize: '11px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  taskTitle: { fontSize: '12.5px', fontWeight: 550, lineHeight: 1.35, flex: 1, minWidth: 0 },
  phase: { fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, whiteSpace: 'nowrap' },
  meta: { fontSize: '11px', opacity: 0.72, fontVariantNumeric: 'tabular-nums' },
  warm: { fontSize: '11px', color: '#e8590c', fontWeight: 600 },
  barTrack: { height: '4px', borderRadius: '999px', background: 'rgba(128, 128, 128, 0.22)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '999px', opacity: 0.8 },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '10.5px', opacity: 0.65 },
  accept: { fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
  empty: { fontSize: '12px', opacity: 0.65, lineHeight: 1.5 },
  foot: { fontSize: '10.5px', opacity: 0.5, marginTop: '2px' },
  error: { fontSize: '11px', color: '#c92a2a' },
  fresh: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2f9e44' },
  chip: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 },
  removedCard: { opacity: 0.62, borderStyle: 'dashed' },
  button: { appearance: 'none', border: '1px solid rgba(128, 128, 128, 0.35)', background: 'transparent', color: 'inherit', borderRadius: '7px', padding: '3px 9px', fontSize: '11px', fontWeight: 550, cursor: 'pointer', font: 'inherit' },
  buttonPrimary: { borderColor: 'currentColor', fontWeight: 650 },
  buttonDanger: { borderColor: '#c92a2a', color: '#c92a2a' },
  logBox: { margin: 0, maxHeight: '220px', overflow: 'auto', padding: '8px 9px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.22)', border: '1px solid rgba(128, 128, 128, 0.18)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '10.5px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'inherit' },
  notice: { fontSize: '11px', lineHeight: 1.4 },
  banner: { fontSize: '11px', lineHeight: 1.4, color: '#e8590c' },
}

function ActionButton({ label, onClick, disabled, tone }) {
  const extra = tone === 'primary' ? styles.buttonPrimary : tone === 'danger' ? styles.buttonDanger : null
  return (
    <button type="button" style={{ ...styles.button, ...(extra || null), opacity: disabled ? 0.5 : 1 }} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  )
}

function TaskCard({ task, fresh, open, log, pending, acting, onOpen, onAsk, onConfirm, onCancel, onCopy }) {
  const phase = PHASES[task.phase] || { label: task.phase, tone: '#868e96' }
  const finished = task.phase === 'done' || task.phase === 'failed' || task.phase === 'capped'
  const percent = task.cap > 0 ? task.percent : 0
  const verdict = task.accept === 'pass' ? 'pass' : task.accept === 'fail' ? 'fail' : null
  const canStart = !task.running && task.phase !== 'running'
  const logRef = useRef(null)

  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [open, log.text])

  const confirmation = (() => {
    if (!pending) return ''
    if (pending.action === 'stop') return 'The agent is terminated.'
    if (pending.action === 'remove') return 'Its state is archived and hidden; the task definition and logs stay.'
    if (pending.action === 'purge') return 'Deletes the job for good: state, archive, logs and its place in the task list. Cannot be undone.'
    if (pending.action === 'forget') return 'Drops the task definition; logs stay unless you delete first.'
    if (pending.action === 'restore') return 'It comes back on the board with its last archived state.'
    return `It runs against a ${tokens(task.cap)} token cap.`
  })()

  return (
    <div style={{ ...styles.card, borderLeftColor: phase.tone, ...(task.removed ? styles.removedCard : null) }} role="listitem">
      <div style={styles.row}>
        <span style={styles.idBadge}>{task.id}</span>
        <span style={styles.taskTitle}>{task.title}</span>
        {fresh ? <span style={styles.fresh}>new</span> : null}
        {task.removed ? <span style={styles.chip}>removed</span> : null}
      </div>

      <div style={styles.row}>
        <span style={{ ...styles.phase, color: phase.tone }}>{phase.label}</span>
        <span style={styles.meta}>
          {finished ? `finished ${clock(task.finished)}` : task.started ? clock(task.started) : 'not started'}
        </span>
        {task.elapsedS != null ? (
          <span style={styles.meta}>
            {duration(task.elapsedS)}
            {task.wallS ? ` of ${duration(task.wallS)}` : ''}
          </span>
        ) : null}
        {task.stale ? <span style={styles.warm}>no runner update in {duration(task.stateAgeS || 0)}</span> : null}
        {task.parent ? <span style={styles.meta}>after {task.parent.id} ({task.parent.phase})</span> : null}
      </div>

      {task.cap > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={styles.barTrack} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${task.id} token budget used`}>
            <div style={{ ...styles.barFill, width: `${Math.max(percent, 1)}%`, background: phase.tone }} />
          </div>
          <span style={styles.meta}>
            {tokens(task.used)} of {tokens(task.cap)} tokens ({percent}%)
            {task.tokensPerMinute ? `, ${tokens(task.tokensPerMinute)}/min` : ''}
            {task.etaSeconds ? `, about ${duration(task.etaSeconds)} to cap` : ''}
            {task.cacheRead ? `, cache ${tokens(task.cacheRead)}` : ''}
          </span>
        </div>
      ) : null}

      <div style={styles.row}>
        {task.branch ? <span style={styles.mono}>{task.branch}</span> : null}
        {task.lastCommit ? <span style={styles.mono}>{task.lastCommit}</span> : null}
        {verdict ? <span style={{ ...styles.accept, color: verdict === 'pass' ? '#2f9e44' : '#c92a2a' }}>accept {verdict}</span> : null}
      </div>

      {task.note ? <span style={styles.meta}>{task.note}</span> : null}
      {task.killed ? <span style={styles.error}>killed: {task.killed}</span> : null}

      <div style={styles.row}>
        <ActionButton label={open ? 'Hide log' : 'Open log'} onClick={() => onOpen(task.id)} />
        {task.removed ? (
          <>
            <ActionButton label="Restore" tone="primary" onClick={() => onAsk(task.id, 'restore')} disabled={acting} />
            <ActionButton label="Delete" tone="danger" onClick={() => onAsk(task.id, 'purge')} disabled={acting} />
            <ActionButton label="Forget" onClick={() => onAsk(task.id, 'forget')} disabled={acting} />
          </>
        ) : canStart ? (
          <>
            <ActionButton label="Start" tone="primary" onClick={() => onAsk(task.id, 'start')} disabled={acting} />
            {task.removable ? <ActionButton label="Remove" onClick={() => onAsk(task.id, 'remove')} disabled={acting} /> : null}
          </>
        ) : (
          <>
            <ActionButton label="Restart" onClick={() => onAsk(task.id, 'restart')} disabled={acting} />
            <ActionButton label="Stop" tone="danger" onClick={() => onAsk(task.id, 'stop')} disabled={acting} />
          </>
        )}
        {task.branch ? <ActionButton label="Copy branch" onClick={() => onCopy(task.branch)} /> : null}
        {open ? <ActionButton label="Copy log" onClick={() => onCopy(log.text)} /> : null}
      </div>

      {pending && pending.id === task.id ? (
        <div style={styles.row} role="alertdialog" aria-label={`Confirm ${pending.action} ${task.id}`}>
          <span style={styles.meta}>
            {pending.action} {task.id}? {confirmation}
          </span>
          <ActionButton label={`Yes, ${pending.action}`} tone={pending.action === 'purge' || pending.action === 'forget' || pending.action === 'stop' ? 'danger' : 'primary'} onClick={() => onConfirm(task.id, pending.action)} />
          <ActionButton label="Cancel" onClick={onCancel} />
        </div>
      ) : null}

      {task.notice ? <span style={{ ...styles.notice, color: task.notice.ok ? '#2f9e44' : '#c92a2a' }}>{task.notice.text}</span> : null}

      {open ? (
        <div id={`taskboard-log-${task.id}`}>
          {log.missing ? (
            <span style={styles.meta}>No log yet. The runner writes one once the agent starts.</span>
          ) : (
            <pre style={styles.logBox} ref={logRef}>
              {log.text || 'empty'}
            </pre>
          )}
          {log.truncated ? <span style={styles.meta}>Showing the tail only.</span> : null}
        </div>
      ) : null}
    </div>
  )
}

export function TaskPanel() {
  const [snapshot, setSnapshot] = useState({ tasks: [], running: 0, removedCount: 0, warnings: [], updatedAt: null })
  const [mode, setMode] = useState('connecting')
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState(() => readPref('filter', ''))
  const [showRemoved, setShowRemoved] = useState(() => readPref('showRemoved', false))
  const [finishedOpen, setFinishedOpen] = useState(() => readPref('finishedOpen', true))
  const [notify, setNotify] = useState(() => readPref('notify', false))
  const [openId, setOpenId] = useState(() => readPref('openId', null))
  const [log, setLog] = useState({ text: '', truncated: false, missing: false })
  const [pending, setPending] = useState(null)
  const [acting, setActing] = useState(false)
  const [notices, setNotices] = useState({})
  const [freshIds, setFreshIds] = useState([])
  const previous = useRef({})
  const notifyRef = useRef(notify)

  useEffect(() => { writePref('filter', filter) }, [filter])
  useEffect(() => { writePref('showRemoved', showRemoved) }, [showRemoved])
  useEffect(() => { writePref('finishedOpen', finishedOpen) }, [finishedOpen])
  useEffect(() => { writePref('notify', notify); notifyRef.current = notify }, [notify])
  useEffect(() => { writePref('openId', openId) }, [openId])

  // Snapshot stream with a polling fallback.
  useEffect(() => {
    let closed = false
    let timer = null
    let source = null

    const apply = (data) => {
      if (closed) return
      const next = {}
      const fresh = []
      for (const task of data.tasks || []) {
        next[task.id] = task.phase
        const before = previous.current[task.id]
        if (before && before !== task.phase && !ACTIVE_PHASES.includes(task.phase)) {
          fresh.push(task.id)
          if (notifyRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(`Dispatch ${task.id} ${task.phase}`, { body: task.title })
            } catch {
              // Notifications can fail silently; the panel is the source of truth.
            }
          }
        }
      }
      previous.current = next
      if (fresh.length > 0) {
        setFreshIds((current) => Array.from(new Set([...current, ...fresh])))
        window.setTimeout(() => setFreshIds((current) => current.filter((id) => !fresh.includes(id))), 120000)
      }
      setSnapshot(data)
      setError(null)
    }

    const poll = async () => {
      try {
        const response = await fetch('/api/taskboard/state?removed=1', { credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        apply(await response.json())
      } catch (err) {
        if (!closed) setError(String((err && err.message) || err))
      }
    }

    const startPolling = () => {
      if (closed || timer) return
      setMode('polling')
      poll()
      timer = window.setInterval(poll, POLL_MS)
    }

    const connect = () => {
      if (closed) return
      if (document.hidden || typeof window.EventSource !== 'function') {
        startPolling()
        return
      }
      try {
        source = new window.EventSource('/api/taskboard/events')
        source.onopen = () => { if (!closed) setMode('live') }
        source.onmessage = (event) => {
          try {
            apply(JSON.parse(event.data))
            if (!closed) setMode('live')
          } catch {
            // A malformed frame is ignored; the next one replaces it.
          }
        }
        source.onerror = () => {
          if (source) { source.close(); source = null }
          startPolling()
        }
      } catch {
        startPolling()
      }
    }

    const stop = () => {
      if (source) { source.close(); source = null }
      if (timer) { window.clearInterval(timer); timer = null }
    }

    const onVisible = () => {
      stop()
      setMode('connecting')
      connect()
    }

    connect()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      closed = true
      stop()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Log tail while open.
  useEffect(() => {
    if (!openId) return undefined
    let active = true
    const load = async () => {
      if (document.hidden) return
      try {
        const response = await fetch(`/api/taskboard/log?id=${encodeURIComponent(openId)}&lines=200`, { credentials: 'same-origin', cache: 'no-store' })
        const data = await response.json()
        if (active) setLog({ text: data.text || '', truncated: !!data.truncated, missing: !!data.missing })
      } catch {
        if (active) setLog({ text: '', truncated: false, missing: false })
      }
    }
    load()
    const timer = window.setInterval(load, LOG_POLL_MS)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [openId])

  // Escape closes a confirmation first, then the log.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      if (pending) setPending(null)
      else if (openId) setOpenId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, openId])

  const flash = (key, ok, text) => {
    setNotices((current) => ({ ...current, [key]: { ok, text } }))
    window.setTimeout(() => {
      setNotices((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    }, 8000)
  }

  const send = async (action, id) => {
    setActing(true)
    setPending(null)
    try {
      const response = await fetch('/api/taskboard/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-taskboard': '1' },
        body: JSON.stringify({ action, ...(id ? { id } : {}) }),
      })
      const data = await response.json()
      flash(id || action, !!data.ok, data.message || (data.ok ? 'done' : 'refused'))
    } catch (err) {
      flash(id || action, false, String((err && err.message) || err))
    } finally {
      setActing(false)
    }
  }

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') { flash('notify', false, 'notifications are not available here'); return }
    let permission = Notification.permission
    if (permission === 'default') permission = await Notification.requestPermission()
    if (permission === 'granted') { setNotify(true); flash('notify', true, 'notifications on') }
    else flash('notify', false, 'notifications blocked by the browser')
  }

  const tasks = snapshot.tasks || []
  const query = filter.trim().toLowerCase()
  const filtered = tasks.filter((task) => {
    if (task.removed && !showRemoved) return false
    if (!query) return true
    return `${task.id} ${task.title} ${task.branch || ''} ${task.phase}`.toLowerCase().includes(query)
  })
  const active = filtered.filter((task) => ACTIVE_PHASES.includes(task.phase))
  const finished = filtered.filter((task) => !ACTIVE_PHASES.includes(task.phase))
  const runningCount = tasks.filter((task) => task.phase === 'running').length

  const card = (task) => (
    <TaskCard
      key={task.id}
      task={{ ...task, notice: notices[task.id] }}
      fresh={freshIds.includes(task.id)}
      open={openId === task.id}
      log={log}
      pending={pending && pending.id ? pending : null}
      acting={acting}
      onOpen={(id) => setOpenId((current) => (current === id ? null : id))}
      onAsk={(id, action) => setPending({ id, action })}
      onConfirm={(id, action) => send(action, id)}
      onCancel={() => setPending(null)}
      onCopy={(text) => copyText(text).then((ok) => { if (!ok) flash('copy', false, 'copy failed') })}
    />
  )

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <h2 style={styles.title}>Dispatches</h2>
        <span style={styles.count}>
          {runningCount} running of {filtered.length}
        </span>
      </div>

      {snapshot.warnings && snapshot.warnings.length > 0 ? <span style={styles.banner}>{snapshot.warnings.join('; ')}</span> : null}
      {error ? <div style={styles.error}>status unavailable: {error}</div> : null}
      {notices.action || notices.copy || notices.notify ? (
        <span style={{ ...styles.notice, color: (notices.notify && !notices.notify.ok) || (notices.copy && !notices.copy.ok) ? '#c92a2a' : '#2f9e44' }}>
          {(notices.action || notices.copy || notices.notify).text}
        </span>
      ) : null}

      <div style={styles.controls}>
        <input
          style={styles.input}
          type="search"
          placeholder="Filter by id, title, branch or phase"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter dispatches"
        />
      </div>

      <div style={styles.controls}>
        {runningCount > 0 ? <ActionButton label={`Stop all (${runningCount})`} tone="danger" onClick={() => setPending({ id: null, action: 'stop-all' })} disabled={acting} /> : null}
        {finished.filter((task) => !task.removed).length > 0 ? (
          <ActionButton label={`Archive finished (${finished.filter((task) => !task.removed).length})`} onClick={() => setPending({ id: null, action: 'prune-finished' })} disabled={acting} />
        ) : null}
        {snapshot.removedCount ? (
          <ActionButton label={showRemoved ? 'Hide removed' : `Show removed (${snapshot.removedCount})`} onClick={() => setShowRemoved((value) => !value)} />
        ) : null}
        <ActionButton label={notify ? 'Notifications on' : 'Notify me'} onClick={enableNotifications} />
      </div>

      {pending && pending.id === null ? (
        <div style={styles.row} role="alertdialog" aria-label={`Confirm ${pending.action}`}>
          <span style={styles.meta}>
            {pending.action === 'stop-all'
              ? `Stop ${runningCount} running job(s)? Each agent is terminated.`
              : `Archive ${finished.filter((task) => !task.removed).length} finished job(s)? They move to the archive and can be restored.`}
          </span>
          <ActionButton
            label={`Yes, ${pending.action === 'stop-all' ? 'stop all' : 'archive'}`}
            tone={pending.action === 'stop-all' ? 'danger' : 'primary'}
            onClick={() => send(pending.action)}
          />
          <ActionButton label="Cancel" onClick={() => setPending(null)} />
        </div>
      ) : null}

      {active.length > 0 ? (
        <>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Active</h3>
            <span style={styles.count}>{active.length}</span>
          </div>
          <div role="list" aria-live="polite" aria-label="Active dispatches" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {active.map(card)}
          </div>
        </>
      ) : null}

      {finished.length > 0 ? (
        <>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Finished</h3>
            <ActionButton label={finishedOpen ? 'Hide' : `Show (${finished.length})`} onClick={() => setFinishedOpen((value) => !value)} />
          </div>
          {finishedOpen ? (
            <div role="list" aria-label="Finished dispatches" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {finished.map(card)}
            </div>
          ) : null}
        </>
      ) : null}

      {filtered.length === 0 && !error ? (
        <p style={styles.empty}>
          {tasks.length === 0
            ? 'No dispatches are registered. When a headless task starts, its state appears here.'
            : 'Nothing matches the filter.'}
        </p>
      ) : null}

      <span style={styles.foot}>
        {snapshot.updatedAt ? `updated ${clock(snapshot.updatedAt)}` : 'waiting for the host'} · {mode}
      </span>
    </div>
  )
}

export function TaskIcon({ size }) {
  const edge = typeof size === 'number' ? size : 16
  return (
    <svg width={edge} height={edge} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <rect x="2.2" y="3" width="11.6" height="3.2" rx="1.1" />
      <rect x="2.2" y="7.6" width="11.6" height="2.2" rx="1" opacity="0.7" />
      <rect x="2.2" y="11.2" width="7.6" height="2" rx="1" opacity="0.45" />
    </svg>
  )
}

export const name = ID
export const inject = ['slots']

export function apply(ctx) {
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: ID }, TaskPanel))
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register({ name: 'sidebar.panellist', id: ID, order: 30, label: 'Dispatches' }, TaskIcon),
  )
}
