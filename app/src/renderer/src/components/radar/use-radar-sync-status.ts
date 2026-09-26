import { useEffect, useState } from 'react'
import type { RadarSyncStatus } from '../../../../shared/radar-join'
import type { RadarConnectionFailure } from '../../../../shared/radar-update'

const STOPPED: RadarSyncStatus = {
  state: 'stopped',
  folder: null,
  files: null,
  message: null,
  conflicts: [],
  stopReason: null
}

/** Live status of the sync agent in the main process. */
export function useRadarSyncStatus(): RadarSyncStatus {
  const [sync, setSync] = useState<RadarSyncStatus>(STOPPED)
  useEffect(() => {
    void window.api.radar.getSyncStatus().then(setSync)
    return window.api.radar.onSyncStatus(setSync)
  }, [])
  return sync
}

export function syncLine(status: RadarSyncStatus): string {
  if (status.state === 'syncing') {
    const files = status.files ?? 0
    return `Syncing ${files} ${files === 1 ? 'file' : 'files'}`
  }
  if (status.state === 'starting') {
    return status.message ?? 'Connecting and downloading files…'
  }
  if (status.state === 'error') {
    return status.message ?? 'Sync stopped'
  }
  return status.message ?? 'Not syncing'
}

/**
 * D-alief-15: a calm sentence when this seat ended for a reason a new token cannot fix,
 * from the sync agent's stop reason or the app socket's close reason. Null otherwise.
 */
export function endedNotice(
  status: RadarSyncStatus,
  failure: RadarConnectionFailure | null
): string | null {
  const reason = status.stopReason ?? failure
  const files = status.folder ? ` Your files stay in ${status.folder}.` : ''
  if (reason === 'workspace-closed') {
    return `The owner stopped sharing.${files} Join with a new code.`
  }
  if (reason === 'signed-out') {
    return `You joined from another device, so this Mac stopped syncing.${files} Join with a new code to use this Mac again.`
  }
  if (reason === 'replaced') {
    return 'Another Live Collab app on this Mac took over this folder.'
  }
  return null
}

/** Electron prefixes IPC errors with the channel name; keep only the server's sentence. */
export function ipcErrorText(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    : ''
}
