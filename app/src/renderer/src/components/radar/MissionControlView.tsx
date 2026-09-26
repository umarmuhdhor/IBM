import { useState } from 'react'
import { DecisionCard, FeedItem, ReviewCard, TaskCard } from '@radar/ui'
import type { FeedKind, ProposalView, RadarState, TaskView } from '@radar/ui'
import { getRadarViewModel } from './radar-view-model'
import { NotificationsPanel } from './NotificationsPanel'

type Props = { state: RadarState; canDecide: boolean }

function proposalTitle(proposal: ProposalView): string {
  const title = proposalPayload(proposal).title
  return typeof title === 'string' && title.trim() ? title : `${proposal.kind} ${proposal.id}`
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

export function MissionControlView({ state, canDecide }: Props) {
  const model = getRadarViewModel(state)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeDecisionId = decidingId && state.proposals[decidingId]?.status === 'menunggu' ? decidingId : null

  const decide = (id: string, approve: boolean) => {
    setError(null)
    setDecidingId(id)
    void window.api.radar.decide(id, approve, '').catch(() => {
      setDecidingId(null)
      setError('Decision failed. Retry after checking the connection.')
    })
  }

  const sections = [
    ['Draft', model.tasks.draft], ['Working', model.tasks.working],
    ['Review', model.tasks.review], ['Done', model.tasks.done]
  ] as const

  return (
    <div className="grid min-h-0 gap-4 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <div className="space-y-4">
        <section aria-label="Tasks">
          <h3 className="mb-2 text-sm font-semibold">Tasks</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {sections.map(([label, tasks]) => (
              <div key={label} className="space-y-2">
                <h4 className="text-xs text-muted-foreground">{label} · {tasks.length}</h4>
                {tasks.map((task: TaskView) => {
                  const member = state.members[task.ownerId]
                  return <TaskCard key={task.id} id={task.id} title={task.title} ownerId={task.ownerId} ownerInitials={member?.name.charAt(0) ?? '?'} ownerStatus={member?.online ? 'online' : member?.stale ? 'stale' : 'offline'} status={task.status} fileCount={task.files.length} editCount={task.editCount} commitSha={task.commitSha} />
                })}
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Live feed">
          <h3 className="mb-2 text-sm font-semibold">Live feed</h3>
          {state.feed.length ? state.feed.slice(0, 30).map((item) => <FeedItem key={item.id} ts={item.ts} actor={item.actor} kind={feedKind(item.type)} text={item.text.replace(/^\d{2}:\d{2}\s+/, '')} />) : <p className="text-xs text-muted-foreground">Activity will appear here.</p>}
        </section>
      </div>
      <div className="space-y-4">
        <NotificationsPanel state={state} />
        <section aria-label="Needs you" className="space-y-2">
          <h3 className="text-sm font-semibold">Needs you · {model.needsYou}</h3>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {model.pending.length === 0 && <p className="text-xs text-muted-foreground">No decisions pending.</p>}
          {model.pending.map((proposal) => {
            const payload = proposalPayload(proposal)
            return proposal.kind === 'review' ? (
              <ReviewCard key={proposal.id} title={proposalTitle(proposal)} added={Number(payload.added) || 0} removed={Number(payload.removed) || 0} fileCount={Number(payload.fileCount) || 0} verdict={proposal.reason} readOnly={!canDecide} pending={activeDecisionId === proposal.id} onApprove={() => decide(proposal.id, true)} onSendBack={() => decide(proposal.id, false)} />
            ) : (
              <DecisionCard key={proposal.id} title={proposalTitle(proposal)} reason={proposal.reason} readOnly={!canDecide} status={activeDecisionId === proposal.id ? 'deciding' : 'pending'} onApprove={() => decide(proposal.id, true)} onDeny={() => decide(proposal.id, false)} />
            )
          })}
          {!canDecide && model.needsYou > 0 && <p className="text-xs text-muted-foreground">Only Mission Control can decide.</p>}
        </section>
        <section aria-label="Files and locks">
          <h3 className="mb-2 text-sm font-semibold">Files & locks</h3>
          <p className="text-xs text-muted-foreground">{Object.keys(state.files).length} files · {Object.keys(state.locks).length} locks</p>
        </section>
      </div>
    </div>
  )
}
