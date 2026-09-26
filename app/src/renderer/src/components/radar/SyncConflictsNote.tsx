import type { RadarSyncStatus } from '../../../../shared/radar-join'

const SHOWN = 3

/**
 * D-alief-14: when a local file differed from the server, the server's copy is used and the local one is kept
 * next to it as `<file>.radar-conflict`. Say so, with the file names, instead of replacing it silently.
 */
export function SyncConflictsNote({ sync }: { sync: RadarSyncStatus }) {
  const count = sync.conflicts.length
  if (count === 0) {
    return null
  }
  const names = sync.conflicts.slice(0, SHOWN).join(', ')
  const more = count > SHOWN ? ` and ${count - SHOWN} more` : ''
  return (
    <p role="status" className="text-xs text-[var(--lc-warn)] [overflow-wrap:anywhere]">
      {count === 1 ? '1 file' : `${count} files`} differed from the server, so the version on the
      server is used. Your copy is kept next to it as .radar-conflict: {names}
      {more}.
    </p>
  )
}
