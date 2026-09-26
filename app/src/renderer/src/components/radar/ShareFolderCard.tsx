import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import { DEFAULT_RADAR_SERVER, type RadarJoinCode } from '../../../../shared/radar-join'
import { ipcErrorText, syncLine, useRadarSyncStatus } from './use-radar-sync-status'

type Props = {
  connection: RadarConnectionSummary | null
  /** The folder open in the app, shared with one click. */
  folder: string | null
  /** The code made by the last share; it outlives this card when the panel switches views. */
  sharedCode: RadarJoinCode | null
  onConnectionChange: (connection: RadarConnectionSummary | null) => void
  onShared: (code: RadarJoinCode) => void
}

function folderName(path: string): string {
  return path.split(/[\\/]/).findLast(Boolean) ?? path
}

/**
 * D-alief-12: open a folder, click Share, send the code. The folder stays where it is and syncs live;
 * the code is copied for you. Replacing a shared folder asks for confirmation first.
 */
export function ShareFolderCard({
  connection,
  folder,
  sharedCode,
  onConnectionChange,
  onShared
}: Props) {
  const sync = useRadarSyncStatus()
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const owner = connection?.role === 'mc'
  // Only offer the open folder when it is not the one already shared.
  const openFolder = folder && folder !== sync.folder ? folder : null

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setMessage(`Copied ${code}. Send it to your teammate.`)
    } catch {
      setMessage(`Unable to copy. Select ${code} and copy it by hand.`)
    }
  }

  const share = async (target: string | null) => {
    setBusy(true)
    setMessage(null)
    setInvalid(false)
    try {
      const result = await window.api.radar.shareFolder(target, DEFAULT_RADAR_SERVER)
      if (!result) {
        return
      }
      setReplacing(false)
      onShared(result.code)
      onConnectionChange(result.connection)
      await copy(result.code.code)
    } catch (error) {
      setMessage(
        ipcErrorText(error) || 'Unable to share the folder. Check your internet connection.'
      )
      setInvalid(true)
    } finally {
      setBusy(false)
    }
  }

  const stopSharing = async () => {
    setBusy(true)
    setMessage(null)
    setInvalid(false)
    try {
      await window.api.radar.stopSharing()
      setStopping(false)
      onConnectionChange(null)
      setMessage('Sharing stopped. The server is empty, so a teammate can share their folder now.')
    } catch (error) {
      setMessage(ipcErrorText(error) || 'Unable to stop sharing. Check your internet connection.')
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

  if (owner && stopping) {
    return (
      <section
        aria-label="Stop sharing"
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Stop sharing {connection.workspace}?</h3>
          <p className="text-xs text-destructive">
            Everyone is disconnected, and tasks, locks and teammates on the server are removed.
            Files on every Mac stay. Afterwards anyone on the team can share their own folder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => void stopSharing()}
          >
            {busy ? 'Stopping…' : 'Stop sharing'}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setStopping(false)}>
            Cancel
          </Button>
        </div>
        {status}
      </section>
    )
  }

  if (owner && replacing) {
    return (
      <section
        aria-label="Share a different folder"
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Share a different folder?</h3>
          <p className="text-xs text-destructive">
            This replaces {connection.workspace} for everyone. Tasks, locks, files and teammates on
            the server are removed, and teammates need a new code. Files on your Mac stay.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {openFolder && (
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void share(openFolder)}
            >
              {busy ? 'Sharing…' : `Replace with ${folderName(openFolder)}`}
            </Button>
          )}
          <Button
            size="sm"
            variant={openFolder ? 'outline' : 'destructive'}
            disabled={busy}
            onClick={() => void share(null)}
          >
            {openFolder
              ? 'Choose another folder…'
              : busy
                ? 'Sharing…'
                : 'Replace and choose folder…'}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setReplacing(false)}>
            Cancel
          </Button>
        </div>
        {status}
      </section>
    )
  }

  if (owner) {
    return (
      <section
        aria-label="Multiplayer"
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            {sync.folder
              ? `${folderName(sync.folder)} is shared`
              : `${connection.workspace} · owner`}
          </h3>
          {sync.folder ? (
            <p
              className={
                sync.state === 'error'
                  ? 'text-xs text-destructive'
                  : 'text-xs text-muted-foreground'
              }
            >
              {syncLine(sync)} ·{' '}
              <span className="font-mono [overflow-wrap:anywhere]">{sync.folder}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              You are Mission Control for this workspace. Its files are not synced on this Mac.
            </p>
          )}
        </div>
        {sharedCode && (
          <div className="flex flex-wrap items-center gap-3">
            <code
              aria-label="Join code"
              className="rounded-md bg-secondary px-3 py-2 font-mono text-lg tracking-widest"
            >
              {sharedCode.code}
            </code>
            <Button size="sm" variant="outline" onClick={() => void copy(sharedCode.code)}>
              Copy code
            </Button>
          </div>
        )}
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
            variant="ghost"
            onClick={() => {
              setReplacing(true)
              setMessage(null)
              setInvalid(false)
            }}
          >
            Share a different folder…
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setStopping(true)
              setMessage(null)
              setInvalid(false)
            }}
          >
            Stop sharing…
          </Button>
        </div>
        {status}
      </section>
    )
  }

  return (
    <section
      aria-label="Multiplayer"
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Multiplayer</h3>
        <p className="text-xs text-muted-foreground">
          {openFolder
            ? `Share ${folderName(openFolder)} and get a code for your team. The folder stays where it is and syncs live.`
            : 'Open a project folder, then share it and get a code for your team.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {openFolder ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => void share(openFolder)}>
              {busy ? 'Sharing…' : `Share ${folderName(openFolder)}`}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void share(null)}>
              Another folder…
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => void share(null)}>
            {busy ? 'Sharing…' : 'Choose folder and share…'}
          </Button>
        )}
      </div>
      {status}
    </section>
  )
}
