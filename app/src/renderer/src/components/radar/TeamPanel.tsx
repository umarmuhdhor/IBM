import { ChevronRight } from 'lucide-react'
import { memberStatus } from '@radar/common'
import { AgentTag, MemberChip } from '@radar/ui'
import type { RadarState } from '@radar/ui'
import { useAppStore } from '@/store'
import { openWorktreePath } from '@/components/sidebar/WorktreeOpenInMenu'
import { cn } from '@/lib/utils'
import { memberColorVar } from './member-color'
import { RemoveSeatControl } from './RemoveSeatControl'
import { lastPrompt, queueSpots, recentActivity, TASK_STATUS_TEXT } from './radar-lanes'
import { TaskStatusLabel } from './TaskStatusLabel'

type Props = {
  state: RadarState
  now: number
  onWatch: (memberId: string) => void
  /** Opens the Tasks tab, where tasks are worked on and tracked. */
  onOpenTasks?: () => void
  /** Mission Control may remove any seat except A, the owner's (D-alief-20). */
  canRemove?: boolean
}

const OUTCOME_CLASS = { ok: 'text-[var(--lc-ok)]', block: 'text-destructive', muted: 'text-muted-foreground' } as const

function baseName(path: string): string {
  return path.split('/').pop() ?? path
}

export function TeamPanel({ state, now, onWatch, onOpenTasks, canRemove = false }: Props) {
  const activeWorktreeId = useAppStore((store) => store.activeWorktreeId)
  const getKnownWorktreeById = useAppStore((store) => store.getKnownWorktreeById)
  const activeWorktree = activeWorktreeId ? getKnownWorktreeById(activeWorktreeId) : null
  const tasks = Object.values(state.tasks)
  return (
    <section aria-label="Team" className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Team</h3>
        <button type="button" disabled={!activeWorktree} onClick={() => { if (activeWorktree) { void openWorktreePath({ target: 'external-editor', worktreePath: activeWorktree.path, command: 'open -a "IBM Bob"' }) } }} className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50">Open in Bob IDE</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.values(state.members).map((member) => {
          const latest = state.bobActivity[member.id]?.[0]
          const presence = member.online ? member.stale ? 'stale' : 'online' : 'offline'
          // Same bob.activity events drive this and the Watch Bob timeline.
          const bob = memberStatus(state, member.id, now)
          const own = tasks.filter((task) => task.ownerId === member.id && task.status !== 'batal')
          const spots = queueSpots(state, member.id)
          const prompt = lastPrompt(state, member.id)
          const activity = recentActivity(state, member.id)
          return (
            <article key={member.id} aria-label={member.name} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3" style={{ borderTopColor: memberColorVar(member.id), borderTopWidth: 2 }}>
              <header className="flex flex-wrap items-center gap-3">
                <MemberChip member={member.id} initials={member.name.charAt(0)} status={presence} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{member.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {member.role === 'pm' ? 'pm-lead' : 'coder'} · IBM Bob IDE · {presence}
                    {bob !== 'idle' && <> · <span className={cn(bob === 'blocked' ? 'text-destructive' : 'text-[var(--lc-ok)]')}>{bob === 'writing' ? 'writing ✎' : 'blocked'}</span></>}
                  </div>
                </div>
                {member.online && <button type="button" aria-label={`Watch ${member.name}'s Bob`} onClick={() => onWatch(member.id)} className="shrink-0 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">Watch</button>}
                {canRemove && member.id !== 'A' && <RemoveSeatControl memberId={member.id} name={member.name} />}
              </header>
              {latest && <AgentTag member={member.id} label={`${member.name} · Bob ${latest.mode || 'coder'}`} status={bob} />}
              {spots.map((spot) => (
                <p key={spot.path} className="rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs">
                  <span className="font-medium">#{spot.pos} in the queue for <span className="font-mono">{baseName(spot.path)}</span>.</span>{' '}
                  <span className="text-muted-foreground">{spot.holderName} holds {spot.holds}. Working on other files meanwhile.</span>
                </p>
              ))}
              {own.length > 0 && (
                <ul aria-label={`${member.name}'s tasks`} className="space-y-1">
                  {own.map((task) => (
                    <li key={task.id}>
                      <button type="button" onClick={onOpenTasks} disabled={!onOpenTasks} aria-label={`${task.id} ${task.title}, ${TASK_STATUS_TEXT[task.status]}. Open in Tasks`} className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-secondary disabled:pointer-events-none">
                        <span className="shrink-0 font-mono text-muted-foreground">{task.id}</span>
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{task.title}</span>
                        <TaskStatusLabel status={task.status} />
                        {onOpenTasks && <ChevronRight aria-hidden="true" className="size-3 shrink-0 self-center text-muted-foreground" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {prompt && (
                <figure className="rounded-md border border-border px-2.5 py-1.5 text-xs">
                  <figcaption className="text-muted-foreground">{member.name} asked Bob</figcaption>
                  <blockquote className="mt-0.5 [overflow-wrap:anywhere]">“{prompt}”</blockquote>
                </figure>
              )}
              {activity.length > 0 && (
                <div>
                  <h4 className="mb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Bob activity</h4>
                  <ol aria-label={`${member.name}'s Bob activity`} className="space-y-0.5">
                    {activity.map((row) => (
                      <li key={row.id} className="flex items-baseline gap-2 text-xs">
                        <span className="w-11 shrink-0 rounded bg-secondary px-1 text-center font-mono text-[11px] text-muted-foreground">{row.primitive}</span>
                        <span className="min-w-0 flex-1 font-mono [overflow-wrap:anywhere]">{row.detail}</span>
                        {row.outcome && <span className={cn('shrink-0 font-mono', OUTCOME_CLASS[row.outcome.tone])}>{row.outcome.text}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {!latest && own.length === 0 && <p className="text-xs text-muted-foreground">{member.role === 'pm' ? 'Splits the work in Bob (PM Lead mode) and approves plans in the Tasks tab.' : 'No task or Bob activity yet.'}</p>}
            </article>
          )
        })}
      </div>
      {Object.keys(state.members).length === 0 && <p className="text-xs text-muted-foreground">No members yet.</p>}
    </section>
  )
}
