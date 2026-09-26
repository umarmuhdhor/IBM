import { ipcRenderer } from 'electron'
import type {
  RadarJoinCode,
  RadarJoinResult,
  RadarJoinRole,
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
  getSyncStatus: () => Promise<RadarSyncStatus>
  openInBob: () => Promise<string | null>
  showFolder: () => Promise<string>
  onSyncStatus: (callback: (status: RadarSyncStatus) => void) => () => void
}

export const radarJoinApi: RadarJoinApi = {
  joinWithCode: (code, server, name, role) =>
    ipcRenderer.invoke('radar:join-with-code', { code, server, name, role }),
  createJoinCode: () => ipcRenderer.invoke('radar:create-join-code'),
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
