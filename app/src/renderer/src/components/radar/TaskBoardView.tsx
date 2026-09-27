import { useState } from 'react'
import type { RadarState, TaskView } from '@radar/ui'
import { TASK_STATUS_TEXT } from './radar-lanes'

type Props = {
  state: RadarState
  role: 'coder' | 'pm' | 'mc' | null
  memberId: string | null
}

const ACTIVE_STATUSES = new Set(['terbuka', 'dikerjakan'])

// Why: Electron prefixes IPC errors with the channel name; keep only the server's sentence.
function serverMessage(err: unknown, fallback: string): string {
  const text = err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : ''
  return text || fallback
}

function taskProgress(task: TaskView): { checked: number; total: number } {
  const total = task.steps.length
  const checked = task.steps.filter((s) => s.done).length
  return { checked, total }
}

function ProgressBar({ checked, total }: { checked: number; total: number }) {
  if (total === 0) {
    return null
  }
  const pct = Math.round((checked / total) * 100)
  return (
    <div
      role="progressbar"
      aria-valuenow={checked}
      aria-valuemax={total}
      aria-label={`${checked} of ${total} steps done`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
    >
      <div className="h-full bg-[var(--lc-ok)]" style={{ width: `${pct}%` }} />
    </div>
  )
}

function CoderTaskCard({ task }: { task: TaskView }) {
  const [pending, setPending] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const isActive = ACTIVE_STATUSES.has(task.status)
  const { checked, total } = taskProgress(task)

  const toggleStep = (index: number, done: boolean) => {
    setPending((prev) => new Set(prev).add(index))
    setError(null)
    void window.api.radar
      .setTaskStep(task.id, index, done)
      .catch((err: unknown) => {
        setError(serverMessage(err, 'Step update failed. Check the connection and try again.'))
      })
      .finally(() => {
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
      })
  }

  const markDone = () => {
    setSubmitting(true)
    setError(null)
    const summary = `Marked done in the app: ${checked}/${total} steps checked`
    void window.api.radar
      .submitTask(task.id, summary)
      .catch((err: unknown) => {
        const message = serverMessage(err, 'Could not mark the task done. Check the connection and try again.')
        // Why: the server refuses a task with no edits; say what to do next, not only what went wrong.
        setError(/has not changed any file/.test(message) ? `${message} Edit its files in Bob first, then mark it done.` : message)
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <article aria-label={task.title} className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium [overflow-wrap:anywhere]">{task.title}</div>
          <div className="text-xs text-muted-foreground">{TASK_STATUS_TEXT[task.status]}</div>
        </div>
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{task.description}</p>
      )}
      {task.files.length > 0 && (
        <ul className="space-y-0.5">
          {task.files.map((f) => (
            <li key={f} className="font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{f}</li>
          ))}
        </ul>
      )}
      {total > 0 && <ProgressBar checked={checked} total={total} />}
      {task.steps.length > 0 && (
        <ul className="space-y-1">
          {task.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`${task.id}-step-${i}`}
                checked={step.done}
                disabled={pending.has(i) || !isActive}
                onChange={(e) => toggleStep(i, e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor={`${task.id}-step-${i}`} className="text-xs [overflow-wrap:anywhere]">
                {step.text}
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <button
        type="button"
        disabled={!isActive || submitting}
        onClick={markDone}
        className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
      >
        Mark task done
      </button>
    </article>
  )
}

function ReadonlyTaskCard({ task }: { task: TaskView }) {
  const { checked, total } = taskProgress(task)
  return (
    <article aria-label={task.title} className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="text-sm font-medium [overflow-wrap:anywhere]">{task.title}</div>
      <div className="text-xs text-muted-foreground">{TASK_STATUS_TEXT[task.status]}</div>
      {task.files.length > 0 && (
        <ul className="space-y-0.5">
          {task.files.map((f) => (
            <li key={f} className="font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{f}</li>
          ))}
        </ul>
      )}
      {total > 0 && <ProgressBar checked={checked} total={total} />}
      {task.steps.length > 0 && (
        <ul className="space-y-1">
          {task.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 text-muted-foreground">{step.done ? '✓' : '○'}</span>
              <span className="[overflow-wrap:anywhere]">{step.text}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function TaskBoardView({ state, role, memberId }: Props) {
  const allTasks = Object.values(state.tasks).filter((t) => t.status !== 'batal')

  if (role === 'coder') {
    const myTasks = allTasks.filter((t) => t.ownerId === memberId)
    return (
      <section aria-label="My tasks" className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">My tasks</h3>
        {myTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No tasks yet. Your PM splits the work in Bob (PM Lead mode) and the owner approves it.
          </p>
        ) : (
          <div className="space-y-3">
            {myTasks.map((task) => (
              <CoderTaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>
    )
  }

  // pm or mc: group by owner (coders only)
  const coders = Object.values(state.members).filter((m) => m.role === 'coder')
  return (
    <section aria-label="Tasks" className="space-y-4 p-4">
      <h3 className="text-sm font-semibold">Tasks</h3>
      {allTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No tasks yet. Ask Bob in PM Lead mode to split the goal with propose_plan.
        </p>
      ) : (
        coders.map((coder) => {
          const coderTasks = allTasks.filter((t) => t.ownerId === coder.id)
          if (coderTasks.length === 0) {
            return null
          }
          const totalSteps = coderTasks.reduce((acc, t) => acc + t.steps.length, 0)
          const doneSteps = coderTasks.reduce((acc, t) => acc + t.steps.filter((s) => s.done).length, 0)
          return (
            <div key={coder.id} className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">
                {coder.name}
                {totalSteps > 0 && <span className="ml-1 font-normal tabular-nums">{doneSteps}/{totalSteps} steps</span>}
              </h4>
              {coderTasks.map((task) => (
                <ReadonlyTaskCard key={task.id} task={task} />
              ))}
            </div>
          )
        })
      )}
    </section>
  )
}
