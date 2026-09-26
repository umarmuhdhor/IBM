import { useEffect, useState } from 'react'
import type { RadarSyncStatus } from '../../../../shared/radar-join'

const STOPPED: RadarSyncStatus = {
  state: 'stopped',
  folder: null,
  files: null,
  message: null
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

/** Electron prefixes IPC errors with the channel name; keep only the server's sentence. */
export function ipcErrorText(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    : ''
}
