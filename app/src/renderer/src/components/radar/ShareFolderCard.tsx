import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import {
  DEFAULT_RADAR_SERVER,
  type RadarJoinCode,
  type RadarJoinRole
} from '../../../../shared/radar-join'
import { ipcErrorText, syncLine, useRadarSyncStatus } from './use-radar-sync-status'

type Props = {
  connection: RadarConnectionSummary | null
  onConnectionChange: (connection: RadarConnectionSummary | null) => void
  onShared: (code: RadarJoinCode) => void
}

/**
 * D-alief-12: the owner picks a project folder on this Mac. It becomes the workspace, keeps syncing in place,
 * and the first join code is copied for a teammate. Replacing a shared folder asks for confirmation first.
 */
export function ShareFolderCard({ connection, onConnectionChange, onShared }: Props) {
  const sync = useRadarSyncStatus()
  const [name, setName] = useState('')
  const [role, setRole] = useState<RadarJoinRole>('coder')
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const owner = connection?.role === 'mc'

  const share = async () => {
    setBusy(true)
    setMessage(null)
    setInvalid(false)
    try {
      const result = await window.api.radar.shareFolder(name, role, DEFAULT_RADAR_SERVER)
      if (!result) {
        return
      }
      setReplacing(false)
      onShared(result.code)
      onConnectionChange(result.connection)
      const copied = await navigator.clipboard
        .writeText(result.code.code)
        .then(() => true)
        .catch(() => false)
      const skipped =
        result.skipped > 0 ? ` (${result.skipped} binary or large files stay local)` : ''
      setMessage(
        `Shared ${result.files} files${skipped}. ${copied ? `Code ${result.code.code} is copied` : `Copy code ${result.code.code}`} and send it to a teammate.`
      )
    } catch (error) {
      setMessage(
        ipcErrorText(error) || 'Unable to share the folder. Check your internet connection.'
      )
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

  const status = (
    <p
      role="status"
      className={invalid ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
    >
      {message}
    </p>
  )

  if (owner && !replacing) {
    return (
      <section
        aria-label="Your shared folder"
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            {connection.workspace} · {sync.folder ? 'your folder' : 'owner'}
          </h3>
          {sync.folder ? (
            <>
              <p
                className={
                  sync.state === 'error'
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {syncLine(sync)}
              </p>
              <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {sync.folder}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              You are Mission Control for this workspace. Its files are not synced on this Mac.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {sync.folder && (
            <>
              <Button size="sm" onClick={() => void openInBob()}>
                Open in IBM Bob
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void window.api.radar.showFolder()}
              >
                Show folder
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setReplacing(true)
              setMessage(null)
              setInvalid(false)
            }}
          >
            Share a different folder…
          </Button>
        </div>
        {status}
      </section>
    )
  }

  return (
    <form
      aria-label={replacing ? 'Share a different folder' : 'Share a folder'}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void share()
      }}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          {replacing ? 'Share a different folder' : 'Share a folder'}
        </h3>
        {replacing ? (
          <p className="text-xs text-destructive">
            This replaces {connection?.workspace} for everyone. Tasks, locks, files and teammates on
            the server are removed, and teammates need a new code. Files on your Mac stay.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Own a project? Pick its folder. It stays where it is and syncs live, and you get a code
            to send to your team.
          </p>
        )}
      </div>
      <label className="block max-w-xs space-y-1 text-xs">
        <span>Your name</span>
        <Input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="How your team sees you"
          autoComplete="name"
          maxLength={100}
        />
      </label>
      <div className="space-y-1 text-xs">
        <span id="radar-share-role">Your role</span>
        <ToggleGroup
          type="single"
          aria-labelledby="radar-share-role"
          value={role}
          onValueChange={(value) => {
            if (value === 'coder' || value === 'pm') {
              setRole(value)
            }
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="coder" className="px-3 text-xs">
            Coder
          </ToggleGroupItem>
          <ToggleGroupItem value="pm" className="px-3 text-xs">
            PM
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          variant={replacing ? 'destructive' : 'default'}
          disabled={busy}
        >
          {busy
            ? 'Sharing…'
            : replacing
              ? 'Replace and choose folder…'
              : 'Choose folder and share…'}
        </Button>
        {replacing && (
          <Button type="button" size="sm" variant="outline" onClick={() => setReplacing(false)}>
            Cancel
          </Button>
        )}
      </div>
      {status}
    </form>
  )
}
