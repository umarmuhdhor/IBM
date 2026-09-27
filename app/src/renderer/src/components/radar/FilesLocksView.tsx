import type { RadarState } from '@radar/ui'
import { repoRows } from './radar-lanes'
import { SharedRepoList } from './SharedRepoList'

export function FilesLocksView({ state, now }: { state: RadarState; now: number }) {
  const rows = repoRows(state, now)
  const locked = rows.filter((row) => row.lock).length
  return (
    <section aria-label="Files and locks" className="space-y-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Shared repo</h3>
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'file' : 'files'} · {locked} locked
        </span>
      </div>
      <p className="text-xs text-muted-foreground">One Bob per file. Others queue and keep working on their other files.</p>
      <SharedRepoList rows={rows} emptyText="No files have been synced yet." />
    </section>
  )
}
