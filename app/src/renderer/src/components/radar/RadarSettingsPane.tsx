import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { RadarChecks } from '../../../../shared/radar-checks'
import type { RadarConnection, RadarConnectionSummary } from '../../../../shared/radar-connection'

type Props = {
  connection: RadarConnectionSummary | null
  connected: boolean
  workspacePath: string | null
  onConnectionChange: (connection: RadarConnectionSummary | null) => void
}

type CheckRow = { label: string; ok: boolean; value: string; mono?: boolean }

function settingsCheckValue(found: boolean | null): string {
  if (found === null) {
    return 'Open a workspace folder first'
  }
  return found ? 'Found' : 'Missing. Add the Bob kit to this folder'
}

function checkRows(connected: boolean, checks: RadarChecks): CheckRow[] {
  return [
    { label: 'WebSocket', ok: connected, value: connected ? 'Connected' : 'Not connected. Check the server URL and access token' },
    { label: 'Bob Shell', ok: checks.bobVersion !== null, value: checks.bobVersion ?? 'Not found. Install Bob Shell', mono: checks.bobVersion !== null },
    { label: '.bob/settings.json', ok: checks.bobSettings === true, value: settingsCheckValue(checks.bobSettings) }
  ]
}

export function RadarSettingsPane({ connection, connected, workspacePath, onConnectionChange }: Props) {
  const [server, setServer] = useState(connection?.server ?? '')
  const [workspace, setWorkspace] = useState(connection?.workspace ?? '')
  const [member, setMember] = useState(connection?.member ?? '')
  const [role, setRole] = useState<RadarConnection['role']>(connection?.role ?? 'coder')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [checks, setChecks] = useState<RadarChecks | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!connection) {
      return
    }
    setServer(connection.server)
    setWorkspace(connection.workspace)
    setMember(connection.member)
    setRole(connection.role)
  }, [connection])

  const connect = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const saved = await window.api.radar.setConnection({ server, workspace, member, role, token })
      setToken('')
      onConnectionChange(saved)
      setMessage('Connection saved. Waiting for workspace state.')
    } catch {
      setMessage('Connection could not be saved. Check the fields and OS encryption.')
    } finally {
      setBusy(false)
    }
  }

  const runChecks = async () => {
    setChecking(true)
    try {
      setChecks(await window.api.radar.runChecks(workspacePath))
    } catch {
      setMessage('Unable to run checks. Try again.')
    } finally {
      setChecking(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      await window.api.radar.clearConnection()
      onConnectionChange(null)
      setToken('')
      setMessage('Connection removed.')
    } catch {
      setMessage('Unable to forget the connection. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form aria-label="Live Collab settings" className="max-w-lg space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); void connect() }}>
      <h3 className="text-sm font-semibold">Connection</h3>
      <p className="text-xs text-muted-foreground">{connected ? 'Connected to Live Collab' : connection ? 'Saved, waiting for server' : 'Connect to a Live Collab workspace'}</p>
      <label className="block text-xs">Server URL<input required type="url" value={server} onChange={(event) => setServer(event.target.value)} placeholder="http://localhost:8787" className="mt-1 w-full rounded-md border border-border bg-card p-2" /></label>
      <label className="block text-xs">Workspace<input required value={workspace} onChange={(event) => setWorkspace(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-card p-2" /></label>
      <label className="block text-xs">Member<input required value={member} onChange={(event) => setMember(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-card p-2" /></label>
      <label className="block text-xs">Role<select value={role} onChange={(event) => setRole(event.target.value === 'mc' ? 'mc' : 'coder')} className="mt-1 w-full rounded-md border border-border bg-card p-2"><option value="coder">Coder</option><option value="mc">Mission Control</option></select></label>
      <label className="block text-xs">Access token<input required type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" className="mt-1 w-full rounded-md border border-border bg-card p-2" /></label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">Connect</button>
        <button type="button" disabled={busy || checking} onClick={() => void runChecks()} className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50">{checking ? 'Testing…' : 'Test'}</button>
        {connection && <button type="button" disabled={busy} onClick={() => void disconnect()} className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs text-destructive disabled:opacity-50">Forget connection</button>}
      </div>
      <div role="status" className="space-y-3">
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
        {checks && (
          <dl aria-label="Connection checks" className="space-y-1.5 rounded-md border border-border bg-card p-3 text-xs">
            {checkRows(connected, checks).map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3">
                <dt className="flex shrink-0 items-center gap-2">
                  <span aria-hidden className={cn(row.ok ? 'text-[var(--lc-ok)]' : 'text-destructive')}>{row.ok ? '●' : '○'}</span>
                  {row.label}
                </dt>
                <dd className={cn('text-right text-muted-foreground [overflow-wrap:anywhere]', row.mono && 'font-mono')}>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </form>
  )
}
