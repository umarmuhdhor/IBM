import { useState } from 'react'
import type { ProposalView, RadarState } from '@radar/ui'
import { Button } from '@/components/ui/button'
import { serverMessage } from './CoderTaskCard'

type PlanTask = { ref: string; title: string; ownerId: string; files: string[]; steps: string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function planOf(proposal: ProposalView): { goal: string; tasks: PlanTask[] } {
  const payload = isRecord(proposal.payload) ? proposal.payload : {}
  const tasks = Array.isArray(payload.tasks) ? payload.tasks.filter(isRecord) : []
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
  return {
    goal: typeof payload.goal === 'string' ? payload.goal : '',
    tasks: tasks.map((t, i) => ({
      ref: typeof t.ref === 'string' ? t.ref : `t${i + 1}`,
      title: typeof t.title === 'string' ? t.title : '',
      ownerId: typeof t.ownerId === 'string' ? t.ownerId : '',
      files: strings(t.files),
      steps: strings(t.steps)
    }))
  }
}

type Props = {
  proposal: ProposalView
  state: RadarState
  /** Why the viewer cannot decide, or null when they can. */
  readOnlyNote: string | null
}

/** A split waiting for approval: who gets which files and how many steps, with Approve / Send back. */
export function PlanApprovalCard({ proposal, state, readOnlyNote }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plan = planOf(proposal)

  const decide = (approve: boolean) => {
    setBusy(true)
    setError(null)
    void window.api.radar
      .decide(proposal.id, approve, '')
      .catch((err: unknown) => {
        setError(serverMessage(err, 'The decision did not go through. Check the connection and try again.'))
        setBusy(false)
      })
  }

  return (
    <article aria-label={`Plan ${proposal.id}`} className="space-y-3 rounded-lg border border-[var(--lc-needs-you)] bg-card p-4">
      <header className="space-y-1">
        <h4 className="text-sm font-medium [overflow-wrap:anywhere]">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{proposal.id}</span>
          {plan.goal || 'New plan'}
        </h4>
        {proposal.reason && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{proposal.reason}</p>}
      </header>
      <ul className="space-y-2">
        {plan.tasks.map((task) => (
          <li key={task.ref} className="rounded-md bg-secondary/60 px-3 py-2 text-xs">
            <div className="font-medium [overflow-wrap:anywhere]">
              {state.members[task.ownerId]?.name ?? task.ownerId} · {task.title}
            </div>
            <div className="mt-0.5 text-muted-foreground [overflow-wrap:anywhere]">
              {task.files.length > 0 ? task.files.join(', ') : 'No files yet'} · {task.steps.length} steps
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {readOnlyNote ? (
        <p className="text-xs text-muted-foreground">{readOnlyNote}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => decide(true)}>
            Approve and assign
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(false)}>
            Send back
          </Button>
        </div>
      )}
    </article>
  )
}
