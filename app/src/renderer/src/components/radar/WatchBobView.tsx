import { useEffect, useRef } from 'react'
import { BobTrace } from '@radar/ui'
import type { RadarState } from '@radar/ui'
import { cn } from '@/lib/utils'
import { memberColorVar } from './member-color'
import { watchBobMode, watchBobTimeline } from './watch-bob-timeline'

type Props = {
  state: RadarState
  memberId: string
  onStopWatching: () => void
}

function clock(ts: number): string {
  const date = new Date(ts)
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':')
}

export function WatchBobView({ state, memberId, onStopWatching }: Props) {
  const member = state.members[memberId]
  const rows = member ? watchBobTimeline(state, memberId) : []
  const hasHiddenPrompt = rows.some((row) => row.kind === 'prompt' && row.detail === 'Prompt text not shared')
  const lastRowRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    // Keep the newest row in view while watching live.
    lastRowRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [rows.length])

  if (!member) {
    return (
      <div className="m-4 rounded-lg border border-border bg-card p-4 text-sm">
        <p>This teammate is not in the workspace any more.</p>
        <button type="button" onClick={onStopWatching} className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs">Back to Team</button>
      </div>
    )
  }

  const title = `Watching ${member.name}'s Bob · ${watchBobMode(state, memberId)}`
  return (
    <section aria-labelledby="watch-bob-title" data-member={memberId} style={{ borderColor: memberColorVar(memberId) }} className="m-4 rounded-lg border bg-card">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <h3 id="watch-bob-title" className="truncate text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">Bob IDE · {member.online ? member.stale ? 'not responding' : 'live' : 'offline'}</p>
        </div>
        <button type="button" onClick={onStopWatching} className="shrink-0 rounded-md border border-border px-2 py-1 text-xs">Stop watching</button>
      </header>
      {rows.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">{`No Bob activity yet. ${member.name}'s prompts, reads, writes and blocks appear here as soon as their Bob IDE hooks report them.`}</p>
      ) : (
        <ol aria-label="Bob activity" className="divide-y divide-border">
          {rows.map((row, index) => (
            <li key={row.id} ref={index === rows.length - 1 ? lastRowRef : undefined} data-kind={row.kind} className={cn('space-y-0.5 px-3 py-1.5 text-xs', row.kind === 'blocked' && 'bg-destructive/10')}>
              <div className="flex items-baseline gap-2">
                <time dateTime={new Date(row.ts).toISOString()} className="shrink-0 font-mono text-muted-foreground tabular-nums">{clock(row.ts)}</time>
                <span className={cn('w-16 shrink-0 font-medium', row.kind === 'blocked' && 'text-destructive')}>{row.label}</span>
                {row.detail && <span className={cn('min-w-0 flex-1 [overflow-wrap:anywhere]', row.kind !== 'prompt' && 'font-mono')}>{row.detail}</span>}
                {row.lines !== null && <span className="shrink-0 font-mono text-muted-foreground">{row.lines} lines</span>}
              </div>
              {row.trace && <BobTrace primitive={row.trace.primitive} detail={row.trace.detail} outcome={row.trace.outcome} className="pl-[4.5rem]" />}
            </li>
          ))}
        </ol>
      )}
      {hasHiddenPrompt && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Prompt text shows only when {member.name} turns on Share my prompts.</p>}
    </section>
  )
}
