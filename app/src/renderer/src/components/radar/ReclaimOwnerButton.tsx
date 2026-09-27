import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import { ipcErrorText } from './use-radar-sync-status'

type Props = { onReclaimed: (connection: RadarConnectionSummary) => void }

/**
 * D-alief-21: when another device took over as owner, the coder who shared the folder takes Mission Control back
 * from this Mac. Main asks the server for a short owner code with the owner seat's token and redeems it at once,
 * so the code is never shown.
 */
export function ReclaimOwnerButton({ onReclaimed }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reclaim = async () => {
    setBusy(true)
    setError(null)
    try {
      onReclaimed(await window.api.radar.reclaimOwner())
    } catch (err) {
      setError(ipcErrorText(err) || 'Could not take back ownership. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" disabled={busy} onClick={() => void reclaim()}>
        {busy ? 'Taking back…' : 'Take back ownership'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
