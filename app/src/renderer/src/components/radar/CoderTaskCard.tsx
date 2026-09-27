import { useState } from 'react'
import type { TaskView } from '@radar/ui'
import { Button } from '@/components/ui/button'
import { StepProgressBar, stepProgress, TaskStatusLabel } from './TaskStatusLabel'

const ACTIVE = new Set(['terbuka', 'dikerjakan'])

// Why: Electron prefixes IPC errors with the channel name; keep only the server's sentence.
export function serverMessage(err: unknown, fallback: string): string {
  const text = err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : ''
  return text || fallback
}

/** The prompt Bob gets; radar:copy-text takes at most 200 characters. */
export function bobPrompt(task: TaskView): string {
  const head = `Work on task ${task.id}: `
  const tail = '. Call radar my_tasks, do each step and tick it with radar complete_step.'
  const room = 200 - head.length - tail.length
  const title = task.title.length > room ? `${task.title.slice(0, room - 1)}…` : task.title
  return `${head}${title}${tail}`
}

export function CoderTaskCard({ task }: { task: TaskView }) {
  const [pending, setPending] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<'start' | 'done' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const active = ACTIVE.has(task.status)
  const { checked, total } = stepProgress(task)

  const toggleStep = (index: number, done: boolean) => {
    setPending((prev) => new Set(prev).add(index))
    setError(null)
    void window.api.radar
      .setTaskStep(task.id, index, done)
      .catch((err: unknown) => setError(serverMessage(err, 'Step update failed. Check the connection and try again.')))
      .finally(() =>
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
      )
  }

  const startInBob = async () => {
    setBusy('start')
    setError(null)
    setNotice(null)
    try {
      await window.api.radar.activateTask(task.id)
      await window.api.radar.copyText(bobPrompt(task))
      const problem = await window.api.radar.openInBob()
      if (problem) {
        setError(`${problem} The prompt is copied: open the project folder in IBM Bob IDE, pick the Live Collab Coder mode and paste it.`)
      } else {
        setNotice('Bob IDE is opening. The prompt is copied: pick the Live Collab Coder mode and paste it.')
      }
    } catch (err) {
      setError(serverMessage(err, 'Could not start the task. Check the connection and try again.'))
    } finally {
      setBusy(null)
    }
  }

  const markDone = () => {
    setBusy('done')
    setError(null)
    setNotice(null)
    void window.api.radar
      .submitTask(task.id, `Marked done in the app: ${checked}/${total} steps checked`)
      .catch((err: unknown) => {
        const message = serverMessage(err, 'Could not mark the task done. Check the connection and try again.')
        // Why: the server refuses a task with no edits; say what to do next, not only what went wrong.
        setError(/has not changed any file/.test(message) ? `${message} Edit its files in Bob first, then mark it done.` : message)
      })
      .finally(() => setBusy(null))
  }

  return (
    <article aria-label={task.title} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{task.id}</span>
          {task.title}
        </h4>
        <TaskStatusLabel status={task.status} />
      </header>
      {task.description && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{task.description}</p>}
      {task.files.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Your files</div>
          <ul className="space-y-0.5">
            {task.files.map((file) => (
              <li key={file} className="font-mono text-xs [overflow-wrap:anywhere]">{file}</li>
            ))}
          </ul>
        </div>
      )}
      <StepProgressBar checked={checked} total={total} />
      {total > 0 && (
        <ul className="space-y-1.5">
          {task.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`${task.id}-step-${i}`}
                checked={step.done}
                disabled={pending.has(i) || !active}
                onChange={(event) => toggleStep(i, event.target.checked)}
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
      {notice && <p role="status" className="text-xs text-[var(--lc-ok)]">{notice}</p>}
      {active && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy !== null} onClick={() => void startInBob()}>
            Start in Bob
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={markDone}>
            Mark task done
          </Button>
        </div>
      )}
    </article>
  )
}
