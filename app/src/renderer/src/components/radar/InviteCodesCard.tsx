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

/** IN-03, Mission Control only: make a join code per teammate to paste into their app. */
export function InviteCodesCard() {
  const members = useRadarStore((store) => store.state?.members)
  const [codes, setCodes] = useState<Record<string, RadarJoinCode>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const list = Object.values(members ?? {}).sort((a, b) => a.id.localeCompare(b.id))

  const make = async (member: string) => {
    setBusy(member)
    setMessage(null)
    try {
      const code = await window.api.radar.createJoinCode(member)
      setCodes((current) => ({ ...current, [member]: code }))
    } catch (error) {
      // Why: Electron prefixes IPC errors with the channel name; keep only the server's sentence.
      const text =
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
          : ''
      setMessage(text || 'Unable to make a code. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setMessage(`Copied ${code}.`)
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
          Make a code for a member and send it privately. They paste it into Live Collab → Join.
          Using a code signs that member in on the new Mac and signs out their previous device.
        </p>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Waiting for the member list from the server.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((member) => {
            const made = codes[member.id]
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-28">
                  {member.id} · {member.name}
                </span>
                <span className="min-w-10 text-muted-foreground">
                  {member.role === 'pm' ? 'PM' : 'coder'}
                </span>
                {made ? (
                  <>
                    <code className="rounded bg-secondary px-2 py-1 font-mono tracking-widest">
                      {made.code}
                    </code>
                    <Button size="xs" variant="outline" onClick={() => void copy(made.code)}>
                      Copy
                    </Button>
                    <span className="text-muted-foreground">until {until(made.expiresAt)}</span>
                  </>
                ) : (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void make(member.id)}
                  >
                    {busy === member.id ? 'Making…' : 'Make code'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p role="status" className="text-xs text-muted-foreground">
        {message}
      </p>
    </section>
  )
}
