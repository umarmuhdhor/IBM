import { useState } from 'react'
import { DecisionCard, FeedItem, ReviewCard } from '@radar/ui'
import type { FeedKind, ProposalView, RadarState, TaskView } from '@radar/ui'
import { AskBobReviewCard } from './AskBobReviewCard'
import { getRadarViewModel } from './radar-view-model'
import { serverMessage } from './CoderTaskCard'
import { repoRows } from './radar-lanes'
import { SharedRepoList } from './SharedRepoList'
import { memberColorVar } from './member-color'
import { TaskStatusLabel } from './TaskStatusLabel'
import { Button } from '@/components/ui/button'

type Props = {
  state: RadarState
  canDecide: boolean
  now: number
  readOnlyNote?: string
  /** Opens the Tasks tab, where tasks are worked on in detail. */
  onOpenTasks?: () => void
}

const FEED_PREVIEW = 8
const TASK_ID_ORDER = new Intl.Collator(undefined, { numeric: true })
// Needs-attention first, finished last.
const STATUS_ORDER: Record<TaskView['status'], number> = { review: 0, dikerjakan: 1, terbuka: 2, draf: 3, selesai: 4, batal: 5 }

const KIND_TITLE: Record<string, string> = { plan: 'Plan', decision: 'Decision', review: 'Review' }

function proposalTitle(proposal: ProposalView): string {
  const title = proposalPayload(proposal).title
  if (typeof title === 'string' && title.trim()) {
    return title
  }
  return `${KIND_TITLE[proposal.kind] ?? proposal.kind} · ${proposal.refId ?? proposal.id}`
}

/** A number the proposal reported, or undefined so the card hides it instead of showing 0. */
function reported(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function proposalPayload(proposal: ProposalView): Record<string, unknown> {
  return isRecord(proposal.payload) ? proposal.payload : {}
}

function feedKind(type: string): FeedKind {
  if (type === 'lock.blocked' || type === 'file.rejected') {
    return 'blocked'
  }
  if (type.startsWith('proposal.') || type === 'request.decided') {
    return 'decision'
  }
  if (type.startsWith('commit.')) {
    return 'commit'
  }
  if (type.startsWith('file.') || type === 'ai.edit') {
    return 'edit'
  }
  return 'info'
}

export function MissionControlView({ state, canDecide, now, readOnlyNote = 'Only the PM or the owner can decide.', onOpenTasks }: Props) {
  const model = getRadarViewModel(state)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allFiles, setAllFiles] = useState(false)
  const [allFeed, setAllFeed] = useState(false)

  const activeDecisionId = decidingId && state.proposals[decidingId]?.status === 'menunggu' ? decidingId : null

  const decide = (id: string, approve: boolean) => {
    setError(null)
    setDecidingId(id)
    void window.api.radar.decide(id, approve, '').catch((err: unknown) => {
      setDecidingId(null)
      setError(serverMessage(err, 'Decision failed. Retry after checking the connection.'))
    })
  }

  const tasks = Object.values(state.tasks)
    .filter((task) => task.status !== 'batal')
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || TASK_ID_ORDER.compare(a.id, b.id))
  const rows = repoRows(state, now)
  const inUse = rows.filter((row) => row.lock)
  const feed = state.feed.slice(0, allFeed ? 30 : FEED_PREVIEW)

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4">
      <section aria-label="Needs you" className="space-y-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{canDecide ? 'Needs you' : 'Waiting for a decision'} · {model.needsYou}</h3>
          {model.needsYou > 0 && <p className="text-xs text-muted-foreground">{canDecide ? 'Plans and reviews your Bob proposed, and submitted work to review.' : readOnlyNote}</p>}
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        {model.needsYou === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">Nothing needs a decision right now.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {model.pending.map((proposal) => {
              const payload = proposalPayload(proposal)
              return proposal.kind === 'review' ? (
                <ReviewCard key={proposal.id} title={proposalTitle(proposal)} added={reported(payload.added)} removed={reported(payload.removed)} fileCount={reported(payload.fileCount)} verdict={proposal.reason} readOnly={!canDecide} pending={activeDecisionId === proposal.id} onApprove={() => decide(proposal.id, true)} onSendBack={() => decide(proposal.id, false)} />
              ) : (
                <DecisionCard key={proposal.id} title={proposalTitle(proposal)} reason={proposal.reason} readOnly={!canDecide} status={activeDecisionId === proposal.id ? 'deciding' : 'pending'} onApprove={() => decide(proposal.id, true)} onDeny={() => decide(proposal.id, false)} />
              )
            })}
            {model.awaitingReview.map((task) => (
              <AskBobReviewCard key={task.id} task={task} state={state} readOnlyNote={canDecide ? null : 'Waiting for the PM’s Bob to review it.'} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Progress" className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Progress · {model.tasks.done.length} of {tasks.length} done</h3>
          {onOpenTasks && tasks.length > 0 && <Button variant="link" size="xs" onClick={onOpenTasks}>Open Tasks</Button>}
        </div>
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">No tasks yet. The PM splits the brief in Bob (PM Lead mode); approved tasks appear here.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {tasks.map((task: TaskView) => {
              const member = state.members[task.ownerId]
              const done = task.steps.filter((step) => step.done).length
              return (
                <li key={task.id} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-xs">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: memberColorVar(task.ownerId) }} />
                    <span className="truncate">{member?.name ?? task.ownerId}</span>
                  </span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{task.id}</span>
                    {task.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {task.steps.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{done}/{task.steps.length} steps</span>}
                    <TaskStatusLabel status={task.status} />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Files" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{allFiles ? `All files · ${rows.length}` : `Files in use · ${inUse.length}`}</h3>
            {rows.length > inUse.length && (
              <Button variant="link" size="xs" onClick={() => setAllFiles((value) => !value)}>
                {allFiles ? 'Only files in use' : `Show all ${rows.length} files`}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">One Bob per file or block of lines; others work elsewhere or wait in the queue.</p>
          <SharedRepoList rows={allFiles ? rows : inUse} emptyText={rows.length === 0 ? 'No files have been synced yet.' : 'No one is editing a file right now.'} />
        </section>

        <section aria-label="Recent activity" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            {state.feed.length > FEED_PREVIEW && (
              <Button variant="link" size="xs" onClick={() => setAllFeed((value) => !value)}>
                {allFeed ? 'Show less' : 'Show more'}
              </Button>
            )}
          </div>
          {feed.length ? (
            <div>{feed.map((item) => <FeedItem key={item.id} ts={item.ts} actor={item.actor} kind={feedKind(item.type)} text={item.text.replace(/^\d{2}:\d{2}\s+/, '')} />)}</div>
          ) : (
            <p className="text-xs text-muted-foreground">Activity will appear here.</p>
          )}
        </section>
      </div>
    </div>
  )
}
