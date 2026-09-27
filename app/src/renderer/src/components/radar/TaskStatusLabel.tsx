import type { TaskStatus, TaskView } from '@radar/ui'
import { cn } from '@/lib/utils'
import { TASK_STATUS_TEXT } from './radar-lanes'

const DOT: Record<TaskStatus, string> = {
  draf: 'bg-muted-foreground',
  terbuka: 'bg-muted-foreground',
  dikerjakan: 'bg-[var(--lc-ok)]',
  review: 'bg-[var(--lc-warn)]',
  selesai: 'bg-[var(--lc-ok)]',
  batal: 'bg-muted-foreground'
}

/** Task status as a dot plus words, so it never reads as a button. */
export function TaskStatusLabel({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT[status])} />
      {TASK_STATUS_TEXT[status]}
    </span>
  )
}

export function stepProgress(task: TaskView): { checked: number; total: number } {
  return { checked: task.steps.filter((step) => step.done).length, total: task.steps.length }
}

export function StepProgressBar({ checked, total }: { checked: number; total: number }) {
  if (total === 0) {
    return null
  }
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground tabular-nums">
        {checked} of {total} steps done
      </div>
      <div
        role="progressbar"
        aria-valuenow={checked}
        aria-valuemax={total}
        aria-label={`${checked} of ${total} steps done`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div className="h-full bg-[var(--lc-ok)]" style={{ width: `${Math.round((checked / total) * 100)}%` }} />
      </div>
    </div>
  )
}
