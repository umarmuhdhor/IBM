import { AlertCircle } from 'lucide-react'
import type { RadarSyncStatus } from '../../../../shared/radar-join'

const SHOWN = 3
// Why: warning-yellow text is about 2.9:1 on the light theme; the hue goes on the icon and border instead.
const CALLOUT =
  'flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning-background px-2 py-1.5 text-xs text-foreground [overflow-wrap:anywhere]'

/**
 * D-alief-14: when a local file differed from the server, the server's copy is used and the local one is kept
 * next to it as `<file>.radar-conflict`. Say so, with the file names, instead of replacing it silently.
 */
export function SyncConflictsNote({ sync }: { sync: RadarSyncStatus }) {
  const count = sync.conflicts.length
  const names = sync.conflicts.slice(0, SHOWN).join(', ')
  const more = count > SHOWN ? ` and ${count - SHOWN} more` : ''
  return (
    <>
      {count > 0 && (
        <p role="status" className={CALLOUT}>
          <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-status-warning" />
          <span>
            {count === 1 ? '1 file' : `${count} files`} differed from the server, so the version
            on the server is used. Your copy is kept next to it as .radar-conflict: {names}
            {more}.
          </span>
        </p>
      )}
      {/* Why: a change the server refused would otherwise vanish without a word in the app. */}
      {sync.rejected && (
        <p role="status" className={CALLOUT}>
          <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-status-warning" />
          <span>{sync.rejected}</span>
        </p>
      )}
    </>
  )
}
