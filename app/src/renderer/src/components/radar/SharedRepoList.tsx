import { cn } from '@/lib/utils'
import { memberColorVar } from './member-color'
import type { RepoRow } from './radar-lanes'

type Props = { rows: RepoRow[]; emptyText: string }

function splitPath(path: string): [string, string] {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? ['', path] : [path.slice(0, cut + 1), path.slice(cut + 1)]
}

/** Shared repo list as in the /demo replay: path, writing badge, holder · held/reserved/review, queue. */
export function SharedRepoList({ rows, emptyText }: Props) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {rows.map((row) => {
        const [dir, base] = splitPath(row.path)
        return (
          <li key={row.path} data-path={row.path} className="space-y-1 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 font-mono [overflow-wrap:anywhere]">
                <span className="text-muted-foreground">{dir}</span>
                <span className="text-foreground">{base}</span>
              </span>
              {row.holderId && row.lock ? (
                <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full border"
                    style={{ borderColor: memberColorVar(row.holderId), background: row.lock === 'reserved' ? 'transparent' : memberColorVar(row.holderId) }}
                  />
                  <span className={cn(row.lock === 'review' && 'text-[var(--lc-warn)]')}>
                    {row.holderLabel} · {row.lock}
                  </span>
                </span>
              ) : (
                <span className="shrink-0 text-muted-foreground">free</span>
              )}
            </div>
            {(row.writing || row.queue.length > 0) && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {row.writing && (
                  <span className="rounded border border-[var(--lc-ok)]/40 px-1.5 font-mono text-[11px] text-[var(--lc-ok)]">writing</span>
                )}
                {row.queue.map((spot) => (
                  <span key={spot.memberId} className="rounded bg-secondary px-1.5 text-[11px] text-muted-foreground">
                    {spot.name} queued #{spot.pos}
                  </span>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
