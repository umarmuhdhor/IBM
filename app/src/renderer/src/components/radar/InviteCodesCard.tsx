import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRadarStore } from '@/store/radar-store'
import type { RadarJoinCode } from '../../../../shared/radar-join'

function until(expiresAt: number): string {
  return new Date(expiresAt).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * IN-03, Mission Control only (D-alief-10): make an open join code and share it. A teammate who uses it
 * enters their own name and role, and only then appears in the list below.
 */
export function InviteCodesCard() {
  const members = useRadarStore((store) => store.state?.members)
  const [codes, setCodes] = useState<RadarJoinCode[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const joined = Object.values(members ?? {}).sort((a, b) => a.id.localeCompare(b.id))

  const make = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const code = await window.api.radar.createJoinCode()
      setCodes((current) => [code, ...current])
      await copy(code.code)
    } catch (error) {
      // Why: Electron prefixes IPC errors with the channel name; keep only the server's sentence.
      const text =
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
          : ''
      setMessage(text || 'Unable to make a code. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setMessage(`Copied ${code}. Send it to your teammate.`)
    } catch {
      setMessage(`Unable to copy. Select ${code} and copy it by hand.`)
    }
  }

  return (
    <section
      aria-label="Invite teammates"
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Invite teammates</h3>
        <p className="text-xs text-muted-foreground">
          Make a code (it is copied for you) and send it privately. Your teammate pastes it into Live Collab → Join and
          enters their name and role. One code adds one person.
        </p>
      </div>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void make()}>
        {busy ? 'Making…' : 'Make code'}
      </Button>
      {codes.length > 0 && (
        <ul aria-label="Codes you made" className="space-y-2">
          {codes.map((made) => (
            <li key={made.code} className="flex flex-wrap items-center gap-2 text-xs">
              <code className="rounded bg-secondary px-2 py-1 font-mono tracking-widest">
                {made.code}
              </code>
              <Button size="xs" variant="outline" onClick={() => void copy(made.code)}>
                Copy
              </Button>
              <span className="text-muted-foreground">until {until(made.expiresAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {joined.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Joined</h4>
          <ul aria-label="Joined teammates" className="space-y-2">
            {joined.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-28">{member.name}</span>
                <span className="text-muted-foreground">
                  {member.role === 'pm' ? 'PM' : 'coder'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p role="status" className="text-xs text-muted-foreground">
        {message}
      </p>
    </section>
  )
}
