import { ipcRenderer } from 'electron'
import type {
  RadarJoinCode,
  RadarJoinResult,
  RadarJoinRole,
  RadarOpenFolderResult,
  RadarSyncStatus
} from '../../shared/radar-join'

export type RadarJoinApi = {
  joinWithCode: (
    code: string,
    server?: string,
    name?: string,
    role?: RadarJoinRole
  ) => Promise<RadarJoinResult>
  createJoinCode: () => Promise<RadarJoinCode>
  /** Opens a folder picker; null when the owner cancels it. */
  shareFolder: (
    name: string,
    role: RadarJoinRole,
    server?: string
  ) => Promise<RadarOpenFolderResult | null>
  getSyncStatus: () => Promise<RadarSyncStatus>
  openInBob: () => Promise<string | null>
  showFolder: () => Promise<string>
  onSyncStatus: (callback: (status: RadarSyncStatus) => void) => () => void
}

export const radarJoinApi: RadarJoinApi = {
  joinWithCode: (code, server, name, role) =>
    ipcRenderer.invoke('radar:join-with-code', { code, server, name, role }),
  createJoinCode: () => ipcRenderer.invoke('radar:create-join-code'),
  shareFolder: (name, role, server) =>
    ipcRenderer.invoke('radar:share-folder', { name, role, server }),
  getSyncStatus: () => ipcRenderer.invoke('radar:sync-status'),
  openInBob: () => ipcRenderer.invoke('radar:open-in-bob'),
  showFolder: () => ipcRenderer.invoke('radar:show-folder'),
  onSyncStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: RadarSyncStatus): void =>
      callback(status)
    ipcRenderer.on('radar:sync', listener)
    return () => ipcRenderer.removeListener('radar:sync', listener)
  }
}
