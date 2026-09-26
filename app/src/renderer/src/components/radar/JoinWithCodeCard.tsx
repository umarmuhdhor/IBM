import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import { DEFAULT_RADAR_SERVER, type RadarSyncStatus } from '../../../../shared/radar-join'

type Props = {
  connection: RadarConnectionSummary | null
  onConnectionChange: (connection: RadarConnectionSummary | null) => void
}

const STOPPED: RadarSyncStatus = {
  state: 'stopped',
  folder: null,
  files: null,
  message: null
}

function syncLine(status: RadarSyncStatus): string {
  if (status.state === 'syncing') {
    return `Syncing ${status.files ?? 0} files`
  }
  if (status.state === 'starting') {
    return status.message ?? 'Connecting and downloading files…'
  }
  if (status.state === 'error') {
    return status.message ?? 'Sync stopped'
  }
  return status.message ?? 'Not syncing'
}

/** IN-03: paste a join code, and the app connects, syncs ~/live-collab/<workspace> and installs the Bob kit. */
export function JoinWithCodeCard({ connection, onConnectionChange }: Props) {
  const [code, setCode] = useState('')
  const [server, setServer] = useState(DEFAULT_RADAR_SERVER)
  const [showServer, setShowServer] = useState(false)
  const [busy, setBusy] = useState(false)
  // A message belongs to the connection it was written for, so it disappears when that connection changes.
  const connectionKey = connection ? `${connection.workspace}/${connection.member}` : ''
  const [note, setNote] = useState<{ text: string; key: string } | null>(null)
  const message = note && note.key === connectionKey ? note.text : null
  const setMessage = (text: string | null, key = connectionKey) =>
    setNote(text === null ? null : { text, key })
  const [invalid, setInvalid] = useState(false)
  const [sync, setSync] = useState<RadarSyncStatus>(STOPPED)

  useEffect(() => {
    void window.api.radar.getSyncStatus().then(setSync)
    return window.api.radar.onSyncStatus(setSync)
  }, [])

  const join = async () => {
    setBusy(true)
    setMessage(null)
    setInvalid(false)
    try {
      const result = await window.api.radar.joinWithCode(code, server)
      setCode('')
      onConnectionChange(result.connection)
      setMessage(
        `Joined ${result.connection.workspace} as ${result.connection.member} (${result.role === 'pm' ? 'PM' : 'coder'}).`,
        `${result.connection.workspace}/${result.connection.member}`
      )
    } catch (error) {
      // Why: Electron prefixes IPC errors with the channel name; keep only the server's sentence.
      const text =
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
          : ''
      setMessage(text || 'Unable to join. Check the code and your internet connection.')
      setInvalid(true)
    } finally {
      setBusy(false)
    }
  }

  const openInBob = async () => {
    setMessage(
      (await window.api.radar.openInBob()) ??
        'Opened in IBM Bob IDE. Trust the folder, then pick a Live Collab mode.'
    )
  }

  const joined = connection !== null && connection.role === 'coder' && sync.folder !== null

  if (joined) {
    return (
      <section
        aria-label="Your workspace"
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            {connection.workspace} · {connection.member}
          </h3>
          <p
            role="status"
            className={
              sync.state === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
            }
          >
            {syncLine(sync)}
          </p>
          <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {sync.folder}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void openInBob()}>
            Open in IBM Bob
          </Button>
          <Button size="sm" variant="outline" onClick={() => void window.api.radar.showFolder()}>
            Show folder
          </Button>
        </div>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </section>
    )
  }

  return (
    <form
      aria-label="Join with a code"
      className="space-y-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void join()
      }}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Join a workspace</h3>
        <p className="text-xs text-muted-foreground">
          Enter the code from your workspace owner. The files sync to your Mac and open in IBM Bob
          IDE.
        </p>
      </div>
      <label className="block max-w-xs space-y-1 text-xs">
        <span>Join code</span>
        <Input
          required
          aria-invalid={invalid}
          aria-describedby="radar-join-message"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="K7QM-3XPA"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
        />
      </label>
      {showServer && (
        <label className="block max-w-md space-y-1 text-xs">
          <span>Server</span>
          <Input type="url" value={server} onChange={(event) => setServer(event.target.value)} />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Joining…' : 'Join'}
        </Button>
        {!showServer && (
          <Button type="button" variant="link" size="xs" onClick={() => setShowServer(true)}>
            Use another server
          </Button>
        )}
      </div>
      <p
        id="radar-join-message"
        role="status"
        className={invalid ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
      >
        {message}
      </p>
    </form>
  )
}
