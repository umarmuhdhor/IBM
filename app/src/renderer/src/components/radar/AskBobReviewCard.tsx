import { useState } from 'react'
import type { RadarState, TaskView } from '@radar/ui'
import { Button } from '@/components/ui/button'
import { serverMessage } from './CoderTaskCard'

/** The prompt the PM's Bob gets; radar:copy-text takes at most 200 characters. */
export function bobReviewPrompt(task: TaskView): string {
  return `Review task ${task.id} with radar get_task_diff: check changed exports and their importers in other tasks, then send the result with radar propose_review.`
}

type Props = {
  task: TaskView
  state: RadarState
  /** Why the viewer cannot start the review, or null when they can. */
  readOnlyNote: string | null
}

/** A submitted task with no review yet: the PM asks their Bob to review it, then approves the result. */
export function AskBobReviewCard({ task, state, readOnlyNote }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const owner = state.members[task.ownerId]?.name ?? task.ownerId

  const reviewInBob = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await window.api.radar.copyText(bobReviewPrompt(task))
      const problem = await window.api.radar.openInBob()
      if (problem) {
        setError(`${problem} The prompt is copied: open the project folder in IBM Bob IDE, pick the Live Collab PM Lead mode and paste it.`)
      } else {
        setNotice('Bob IDE is opening. The prompt is copied: pick the Live Collab PM Lead mode and paste it. The review appears here to approve.')
      }
    } catch (err) {
      setError(serverMessage(err, 'Could not copy the prompt. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article aria-label={`Review ${task.id}`} className="space-y-2 rounded-lg border border-[var(--lc-needs-you)] bg-card p-3">
      <header className="space-y-0.5">
        <h4 className="text-sm font-medium [overflow-wrap:anywhere]">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{task.id}</span>
          {task.title}
        </h4>
        <p className="text-xs text-muted-foreground">
          {owner} submitted {task.files.length} {task.files.length === 1 ? 'file' : 'files'}. Bob reviews the diff first, then you approve its verdict.
        </p>
      </header>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {notice && <p role="status" className="text-xs text-[var(--lc-ok)]">{notice}</p>}
      {readOnlyNote ? (
        <p className="text-xs text-muted-foreground">{readOnlyNote}</p>
      ) : (
        <Button size="sm" disabled={busy} onClick={() => void reviewInBob()}>
          Review in Bob<span className="sr-only"> ({task.id})</span>
        </Button>
      )}
    </article>
  )
}
