import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useEscapeToCancel } from './use-escape-to-cancel'
import { ipcErrorText } from './use-radar-sync-status'

type Props = { memberId: string; name: string }

/**
 * D-alief-20: Mission Control removes a seat that is no longer used. The confirmation says what happens to the
 * teammate's work; the card disappears when the server's member.removed event arrives.
 */
export function RemoveSeatControl({ memberId, name }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const [refocus, setRefocus] = useState(false)

  useEffect(() => {
    if (confirming) {
      cancelButton.current?.focus()
    } else if (refocus) {
      trigger.current?.focus()
      setRefocus(false)
    }
  }, [confirming, refocus])

  const cancel = () => {
    if (!busy) {
      setConfirming(false)
      setRefocus(true)
    }
  }
  useEscapeToCancel(confirming, cancel)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await window.api.radar.removeMember(memberId)
      setConfirming(false)
    } catch (err) {
      setError(ipcErrorText(err) || `Could not remove ${name}. Try again.`)
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <button
        ref={trigger}
        type="button"
        aria-label={`Remove ${name}`}
        onClick={() => {
          setError(null)
          setConfirming(true)
        }}
        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        Remove
      </button>
    )
  }

  return (
    <div
      role="group"
      aria-label={`Remove ${name}?`}
      className="basis-full space-y-2 rounded-md border border-border bg-secondary/60 p-2.5 text-xs"
    >
      <p>
        Remove {name} from this workspace? Their open tasks are cancelled, and they need a new code
        to join again.
      </p>
      <div className="flex justify-end gap-2">
        <Button ref={cancelButton} size="xs" variant="outline" disabled={busy} onClick={cancel}>
          Cancel
        </Button>
        <Button size="xs" variant="destructive" disabled={busy} onClick={() => void remove()}>
          Remove
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
