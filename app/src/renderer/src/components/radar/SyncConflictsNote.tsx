import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RadarKitNotice, RadarSyncStatus } from '../../../../shared/radar-join'

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
      {sync.kit && <KitNote kit={sync.kit} />}
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

/** Fase 12k: the join left Bob IDE without the kit; say why, and install it with a backup when asked. */
function KitNote({ kit }: { kit: RadarKitNotice }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div role="status" className={CALLOUT}>
      <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-status-warning" />
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <span>{kit.message}</span>
        {kit.status === 'refused' && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setError(null)
              void window.api.radar
                .installBobKit()
                .catch((err: unknown) => {
                  const why = err instanceof Error ? err.message : String(err)
                  setError(`Could not install the Bob kit: ${why}`)
                })
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Installing…' : 'Back up .bob and install the Bob kit'}
          </Button>
        )}
        {error && <span>{error}</span>}
      </div>
    </div>
  )
}
