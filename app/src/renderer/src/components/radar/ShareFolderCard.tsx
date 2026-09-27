import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRadarStore } from '@/store/radar-store'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import { DEFAULT_RADAR_SERVER, type RadarJoinCode } from '../../../../shared/radar-join'
import { ReclaimOwnerButton } from './ReclaimOwnerButton'
import { SyncConflictsNote } from './SyncConflictsNote'
import { confirmDialogProps, useEscapeToCancel } from './use-escape-to-cancel'
import { endedNotice, ipcErrorText, syncLine, useRadarSyncStatus } from './use-radar-sync-status'

type Props = {
  connection: RadarConnectionSummary | null
  /** The folder open in the app, shared with one click. */
  folder: string | null
  /** The code made by the last share; it outlives this card when the panel switches views. */
  sharedCode: RadarJoinCode | null
  onConnectionChange: (connection: RadarConnectionSummary | null) => void
  onShared: (code: RadarJoinCode) => void
}

/** A note belongs to the connection it was written for, so it disappears when that connection changes. */
function noteKey(connection: RadarConnectionSummary | null): string {
  return connection ? `${connection.workspace}/${connection.member}/${connection.role}` : ''
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
  const connectionFailure = useRadarStore((store) => store.connectionFailure)
  const ownerName = useRadarStore((store) => store.state?.members['A']?.name ?? null)
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [stopping, setStopping] = useState(false)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const confirmSection = useRef<HTMLElement>(null)
  const confirmId = useId()
  const replaceButton = useRef<HTMLButtonElement>(null)
  const stopButton = useRef<HTMLButtonElement>(null)
  const [refocus, setRefocus] = useState<'replace' | 'stop' | null>(null)
  const owner = connection?.role === 'mc'
  // D-alief-15: the Mission Control token stopped working, so Stop sharing and codes would only fail.
  const ownerEnded =
    owner && (connectionFailure === 'signed-out' || connectionFailure === 'workspace-closed')
  // Why: notes about sharing (e.g. "Copied …") do not carry over once another device took over.
  const currentKey = `${noteKey(connection)}${ownerEnded ? '/ended' : ''}`
  const [note, setNote] = useState<{ text: string; key: string; error: boolean } | null>(null)
  const message = note && note.key === currentKey ? note.text : null
  const invalid = message !== null && note?.error === true
  const setMessage = (text: string | null, error = false, key = currentKey) =>
    setNote(text === null ? null : { text, key, error })
  // Only offer the open folder when it is not the one already shared.
  const openFolder = folder && folder !== sync.folder ? folder : null

  const cancelConfirm = () => {
    if (busy) {
      return
    }
    setRefocus(replacing ? 'replace' : 'stop')
    setReplacing(false)
    setStopping(false)
  }
  useEscapeToCancel(confirmSection, owner && (replacing || stopping), cancelConfirm)
  // Keyboard focus follows the confirmation in and back out to the button that opened it.
  useEffect(() => {
    if (replacing || stopping) {
      cancelButton.current?.focus()
    }
  }, [replacing, stopping])
  useEffect(() => {
    if (refocus) {
      const opener = refocus === 'replace' ? replaceButton : stopButton
      opener.current?.focus()
      setRefocus(null)
    }
  }, [refocus])

  const copy = async (code: string, key = currentKey) => {
    try {
      await window.api.radar.copyText(code)
      setMessage(`Copied ${code}. Send it to your teammate.`, false, key)
    } catch {
      setMessage(`Unable to copy. Select ${code} and copy it by hand.`, true, key)
    }
  }

  const share = async (target: string | null) => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await window.api.radar.shareFolder(target, DEFAULT_RADAR_SERVER)
      if (!result) {
        return
      }
      setReplacing(false)
      onShared(result.code)
      onConnectionChange(result.connection)
      await copy(result.code.code, noteKey(result.connection))
    } catch (error) {
      setMessage(
        ipcErrorText(error) || 'Unable to share the folder. Check your internet connection.',
        true
      )
    } finally {
      setBusy(false)
    }
  }

  const stopSharing = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await window.api.radar.stopSharing()
      setStopping(false)
      onConnectionChange(null)
      setMessage(
        'Sharing stopped. The server is empty, so a teammate can share their folder now.',
        false,
        noteKey(null)
      )
    } catch (error) {
      setMessage(
        ipcErrorText(error) || 'Unable to stop sharing. Check your internet connection.',
        true
      )
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

  if (ownerEnded) {
    return (
      <section
        aria-label="Multiplayer"
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{connection.workspace}</h3>
          <p className="text-xs text-foreground">
            {connectionFailure === 'signed-out'
              ? 'Another device took over as owner. If it is closed now, take back ownership on this Mac.'
              : 'This workspace is no longer shared from this Mac.'}
          </p>
        </div>
        {connectionFailure === 'signed-out' && <ReclaimOwnerButton onReclaimed={onConnectionChange} />}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void window.api.radar
              .clearConnection()
              .then(() => onConnectionChange(null))
              .finally(() => setBusy(false))
          }}
        >
          Forget this workspace
        </Button>
        {status}
      </section>
    )
  }

  if (owner && stopping) {
    return (
      <section
        ref={confirmSection}
        {...confirmDialogProps(confirmId)}
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <h3 id={`${confirmId}-title`} className="text-sm font-semibold">Stop sharing {connection.workspace}?</h3>
          <p id={`${confirmId}-warning`} className="text-xs text-destructive">
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
          <Button
            ref={cancelButton}
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={cancelConfirm}
          >
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
        ref={confirmSection}
        {...confirmDialogProps(confirmId)}
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <h3 id={`${confirmId}-title`} className="text-sm font-semibold">Share a different folder?</h3>
          <p id={`${confirmId}-warning`} className="text-xs text-destructive">
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
          <Button
            ref={cancelButton}
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={cancelConfirm}
          >
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
          <SyncConflictsNote sync={sync} />
        </div>
        {sharedCode ? (
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
        ) : (
          // Why: codes are shown once and not kept after a restart; new ones come from Invite teammates.
          <p className="text-xs text-muted-foreground">
            To add a teammate, click Make code under Invite teammates and send them the code.
          </p>
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
            ref={replaceButton}
            size="sm"
            variant="ghost"
            onClick={() => {
              setReplacing(true)
              setMessage(null)
            }}
          >
            Share a different folder…
          </Button>
          <Button
            ref={stopButton}
            size="sm"
            variant="ghost"
            onClick={() => {
              setStopping(true)
              setMessage(null)
            }}
          >
            Stop sharing…
          </Button>
        </div>
        {status}
      </section>
    )
  }

  // Why: the server has one workspace; a teammate can share only after the owner stops.
  if (connection && connection.role !== 'mc' && !endedNotice(sync, connectionFailure)) {
    // The teammate's workspace card below already names the workspace; a second card only repeats it.
    if (sync.folder) {
      return null
    }
    return (
      <section
        aria-label="Multiplayer"
        className="space-y-1 rounded-lg border border-border bg-card p-4"
      >
        <h3 className="text-sm font-semibold">Multiplayer</h3>
        <p className="text-xs text-muted-foreground">
          {ownerName ?? 'The owner'} is sharing {connection.workspace}. Ask them to stop sharing
          first, then you can share your own folder.
        </p>
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
