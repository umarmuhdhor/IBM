import { LockChip, WritingPulse } from '@radar/ui'
import type { RadarState } from '@radar/ui'

export function FilesLocksView({ state, now }: { state: RadarState; now: number }) {
  const paths = [...new Set([...Object.keys(state.files), ...Object.keys(state.locks)])].sort()
  return (
    <section aria-label="Files and locks" className="space-y-2 p-4">
      <h3 className="text-sm font-semibold">Files & locks</h3>
      {paths.length === 0 && <p className="text-xs text-muted-foreground">No files have been synced yet.</p>}
      {paths.map((path) => {
        const file = state.files[path]
        const lock = state.locks[path]
        const holder = lock?.memberId ? state.members[lock.memberId] : null
        return (
          <div key={path} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate font-mono" title={path}>{path}</span>
            {file?.updatedBy && file.writingUntil > now && <WritingPulse member={file.updatedBy} />}
            <LockChip state={lock?.state ?? 'bebas'} holder={holder?.name.charAt(0) ?? ''} />
          </div>
        )
      })}
    </section>
  )
}
