// Client half: a first-level sidebar panel listing headless dispatches.
//
// It polls the host every few seconds, renders state, elapsed time, token
// budget, branch, last commit and the acceptance verdict, can open the live log
// of a dispatch, and can start, stop or restart one through the runner. Every
// mutating click asks for confirmation first.

import React, { useEffect, useRef, useState } from 'react'

const ID = 'dsh-taskboard'
const POLL_MS = 5000
const LOG_POLL_MS = 2000

const PHASES = {
  running: { label: 'running', tone: '#2f9e44' },
  stalled: { label: 'runner gone', tone: '#c92a2a' },
  blocked: { label: 'blocked', tone: '#e8590c' },
  queued: { label: 'queued', tone: '#868e96' },
  capped: { label: 'capped', tone: '#c92a2a' },
  failed: { label: 'failed', tone: '#c92a2a' },
  done: { label: 'done', tone: '#2f9e44' },
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

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    height: '100%',
    overflowY: 'auto',
    padding: '16px 16px 24px',
    color: 'inherit',
    font: 'inherit',
  },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' },
  title: { margin: 0, fontSize: '14px', fontWeight: 600, letterSpacing: '0.01em' },
  count: { fontSize: '11px', opacity: 0.65, fontVariantNumeric: 'tabular-nums' },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 12px 11px',
    border: '1px solid rgba(128, 128, 128, 0.22)',
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    borderRadius: '10px',
    background: 'rgba(128, 128, 128, 0.05)',
  },
  row: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  idBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    height: '18px',
    padding: '0 5px',
    borderRadius: '5px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    fontSize: '11px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  taskTitle: {
    fontSize: '12.5px',
    fontWeight: 550,
    lineHeight: 1.35,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  phase: {
    fontSize: '10.5px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  meta: { fontSize: '11px', opacity: 0.72, fontVariantNumeric: 'tabular-nums' },
  barTrack: { height: '4px', borderRadius: '999px', background: 'rgba(128, 128, 128, 0.22)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '999px', opacity: 0.8 },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '10.5px', opacity: 0.65 },
  accept: { fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
  empty: { fontSize: '12px', opacity: 0.65, lineHeight: 1.5 },
  foot: { fontSize: '10.5px', opacity: 0.5, marginTop: '2px' },
  error: { fontSize: '11px', color: '#c92a2a' },
  fresh: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2f9e44' },
  button: {
    appearance: 'none',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'transparent',
    color: 'inherit',
    borderRadius: '7px',
    padding: '3px 9px',
    fontSize: '11px',
    fontWeight: 550,
    cursor: 'pointer',
    font: 'inherit',
  },
  buttonPrimary: { borderColor: 'currentColor', fontWeight: 650 },
  buttonDanger: { borderColor: '#c92a2a', color: '#c92a2a' },
  logBox: {
    margin: 0,
    maxHeight: '220px',
    overflow: 'auto',
    padding: '8px 9px',
    borderRadius: '8px',
    background: 'rgba(0, 0, 0, 0.22)',
    border: '1px solid rgba(128, 128, 128, 0.18)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '10.5px',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'inherit',
  },
  notice: { fontSize: '11px', lineHeight: 1.4 },
  removedCard: { opacity: 0.62, borderStyle: 'dashed' },
  chip: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 },
}

function TaskCard({ task, fresh, open, log, pending, acting, onOpen, onAsk, onConfirm, onCancel }) {
  const phase = PHASES[task.phase] || { label: task.phase, tone: '#868e96' }
  const finished = task.phase === 'done' || task.phase === 'failed' || task.phase === 'capped'
  const percent = task.cap > 0 ? task.percent : 0
  const verdict = task.accept === 'pass' ? 'pass' : task.accept === 'fail' ? 'fail' : null
  const canStart = !task.running && task.phase !== 'running'
  const logRef = useRef(null)

  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [open, log.text])

  return (
    <div style={{ ...styles.card, borderLeftColor: phase.tone, ...(task.removed ? styles.removedCard : null) }} role="listitem">
      <div style={styles.row}>
        <span style={styles.idBadge}>{task.id}</span>
        <span style={styles.taskTitle}>{task.title}</span>
        {fresh ? <span style={styles.fresh}>new</span> : null}
        {task.removed ? <span style={styles.chip}>removed</span> : null}
        {task.removed ? <span style={styles.meta}>Delete removes the job for good.</span> : null}
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
        {task.chainFrom ? <span style={styles.meta}>after {task.chainFrom}</span> : null}
      </div>

      {task.cap > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={styles.barTrack}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${task.id} token budget used`}
          >
            <div style={{ ...styles.barFill, width: `${Math.max(percent, 1)}%`, background: phase.tone }} />
          </div>
          <span style={styles.meta}>
            {tokens(task.used)} of {tokens(task.cap)} tokens ({percent}%)
            {task.cacheRead ? `, cache ${tokens(task.cacheRead)}` : ''}
          </span>
        </div>
      ) : null}

      <div style={styles.row}>
        {task.branch ? <span style={styles.mono}>{task.branch}</span> : null}
        {task.lastCommit ? <span style={styles.mono}>{task.lastCommit}</span> : null}
        {verdict ? (
          <span style={{ ...styles.accept, color: verdict === 'pass' ? '#2f9e44' : '#c92a2a' }}>
            accept {verdict}
          </span>
        ) : null}
      </div>

      {task.note ? <span style={styles.meta}>{task.note}</span> : null}
      {task.killed ? <span style={styles.error}>killed: {task.killed}</span> : null}

      <div style={styles.row}>
        <button
          type="button"
          style={{ ...styles.button, opacity: acting ? 0.5 : 1 }}
          onClick={() => onOpen(task.id)}
          aria-expanded={open}
          aria-controls={`taskboard-log-${task.id}`}
        >
          {open ? 'Hide log' : 'Open log'}
        </button>
        {task.removed ? (
          <>
            <button
              type="button"
              style={{ ...styles.button, ...styles.buttonPrimary, opacity: acting ? 0.5 : 1 }}
              onClick={() => onAsk(task.id, 'restore')}
              disabled={acting}
            >
              Restore
            </button>
            <button
              type="button"
              style={{ ...styles.button, opacity: acting ? 0.5 : 1 }}
              onClick={() => onAsk(task.id, 'purge')}
              disabled={acting}
            >
              Delete
            </button>
            <button
              type="button"
              style={{ ...styles.button, opacity: acting ? 0.5 : 1 }}
              onClick={() => onAsk(task.id, 'forget')}
              disabled={acting}
            >
              Forget
            </button>
          </>
        ) : canStart ? (
          <>
            <button
              type="button"
              style={{ ...styles.button, ...styles.buttonPrimary, opacity: acting ? 0.5 : 1 }}
              onClick={() => onAsk(task.id, 'start')}
              disabled={acting}
            >
              Start
            </button>
            {task.removable ? (
              <button
                type="button"
                style={{ ...styles.button, opacity: acting ? 0.5 : 1 }}
                onClick={() => onAsk(task.id, 'remove')}
                disabled={acting}
              >
                Remove
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              style={{ ...styles.button, opacity: acting ? 0.5 : 1 }}
              onClick={() => onAsk(task.id, 'restart')}
              disabled={acting}
            >
              Restart
            </button>
            <button
              type="button"
              style={{ ...styles.button, ...styles.buttonDanger, opacity: acting ? 0.5 : 1 }}
              onClick={() => onAsk(task.id, 'stop')}
              disabled={acting}
            >
              Stop
            </button>
          </>
        )}
      </div>

      {pending && pending.id === task.id ? (
        <div style={styles.row} role="alertdialog" aria-label={`Confirm ${pending.action} ${task.id}`}>
          <span style={styles.meta}>
            {pending.action} {task.id}? {pending.action === 'stop' ? 'The agent is terminated.' : pending.action === 'remove' ? 'Its state is archived and hidden; the task definition and logs stay.' : pending.action === 'purge' ? 'Deletes the job for good: state, archive, logs and its place in the task list. Cannot be undone.' : pending.action === 'forget' ? 'Drops the task definition; logs stay unless you delete first.' : pending.action === 'restore' ? 'It comes back on the board with its last archived state.' : `It runs against a ${tokens(task.cap)} token cap.`}
          </span>
          <button
            type="button"
            style={{ ...styles.button, ...(pending.action === 'purge' || pending.action === 'forget' ? styles.buttonDanger : styles.buttonPrimary) }}
            onClick={() => onConfirm(task.id, pending.action)}
          >
            Yes, {pending.action}
          </button>
          <button type="button" style={styles.button} onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : null}

      {task.notice ? (
        <span style={{ ...styles.notice, color: task.notice.ok ? '#2f9e44' : '#c92a2a' }}>{task.notice.text}</span>
      ) : null}

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
  const [state, setState] = useState({ tasks: [], running: 0, updatedAt: null, error: null })
  const [freshIds, setFreshIds] = useState([])
  const [openId, setOpenId] = useState(null)
  const [log, setLog] = useState({ text: '', truncated: false, missing: false })
  const [pending, setPending] = useState(null)
  const [acting, setActing] = useState(false)
  const [notices, setNotices] = useState({})
  const [showRemoved, setShowRemoved] = useState(false)
  const previous = useRef({})
  const loadRef = useRef(null)

  useEffect(() => {
    let alive = true
    let timer = 0

    const load = async () => {
      try {
        const response = await fetch(`/api/taskboard/state${showRemoved ? '?removed=1' : ''}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (!alive) return
        const next = {}
        const fresh = []
        for (const task of data.tasks || []) {
          next[task.id] = task.phase
          const before = previous.current[task.id]
          if (before && before !== task.phase && task.phase !== 'running' && task.phase !== 'queued') fresh.push(task.id)
        }
        previous.current = next
        if (fresh.length > 0) {
          setFreshIds((current) => Array.from(new Set([...current, ...fresh])))
          window.setTimeout(() => {
            if (alive) setFreshIds((current) => current.filter((id) => !fresh.includes(id)))
          }, 120000)
        }
        setState({
          tasks: data.tasks || [],
          running: data.running || 0,
          removedCount: data.removedCount || 0,
          updatedAt: data.updatedAt || null,
          error: null,
        })
      } catch (error) {
        if (alive) setState((current) => ({ ...current, error: String((error && error.message) || error) }))
      }
    }

    loadRef.current = load
    load()
    timer = window.setInterval(load, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [showRemoved])

  useEffect(() => {
    if (!openId) return undefined
    let alive = true
    const loadLog = async () => {
      try {
        const response = await fetch(`/api/taskboard/log?id=${encodeURIComponent(openId)}&lines=200`, {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        const data = await response.json()
        if (alive) setLog({ text: data.text || '', truncated: !!data.truncated, missing: !!data.missing })
      } catch {
        if (alive) setLog({ text: '', truncated: false, missing: false })
      }
    }
    loadLog()
    const timer = window.setInterval(loadLog, LOG_POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [openId])

  const send = async (id, action) => {
    setActing(true)
    setPending(null)
    try {
      const response = await fetch('/api/taskboard/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-taskboard': '1' },
        body: JSON.stringify({ id, action }),
      })
      const data = await response.json()
      setNotices((current) => ({
        ...current,
        [id]: { ok: !!data.ok, text: data.message || (data.ok ? 'done' : 'refused') },
      }))
      window.setTimeout(() => {
        setNotices((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
      }, 8000)
      if (loadRef.current) loadRef.current()
    } catch (error) {
      setNotices((current) => ({ ...current, [id]: { ok: false, text: String((error && error.message) || error) } }))
    } finally {
      setActing(false)
    }
  }

  const tasks = (state.tasks || []).map((task) => ({
    ...task,
    notice: notices[task.id],
  }))

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <h2 style={styles.title}>Dispatches</h2>
        <span style={styles.count}>
          {state.running} running of {tasks.length}
        </span>
      </div>

      {state.removedCount ? (
        <div style={styles.row}>
          <button
            type="button"
            style={styles.button}
            onClick={() => setShowRemoved((current) => !current)}
            aria-pressed={showRemoved}
          >
            {showRemoved ? 'Hide removed' : `Show removed (${state.removedCount})`}
          </button>
        </div>
      ) : null}

      {state.error ? <div style={styles.error}>status unavailable: {state.error}</div> : null}

      <div role="list" aria-live="polite" aria-label="Headless dispatch status" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            fresh={freshIds.includes(task.id)}
            open={openId === task.id}
            log={log}
            pending={pending}
            acting={acting}
            onOpen={(id) => setOpenId((current) => (current === id ? null : id))}
            onAsk={(id, action) => setPending({ id, action })}
            onConfirm={(id, action) => send(id, action)}
            onCancel={() => setPending(null)}
          />
        ))}
      </div>

      {tasks.length === 0 && !state.error ? (
        <p style={styles.empty}>No dispatches are registered. When a headless task starts, its state appears here within a few seconds.</p>
      ) : null}

      <span style={styles.foot}>
        {state.updatedAt ? `updated ${clock(state.updatedAt)}` : 'waiting for the host'} · polled every {POLL_MS / 1000}s
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
