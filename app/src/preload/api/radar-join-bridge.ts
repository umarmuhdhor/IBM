import { ipcRenderer } from 'electron'
import type { RadarJoinCode, RadarJoinResult, RadarSyncStatus } from '../../shared/radar-join'

export type RadarJoinApi = {
  joinWithCode: (code: string, server?: string) => Promise<RadarJoinResult>
  createJoinCode: (member: string) => Promise<RadarJoinCode>
  getSyncStatus: () => Promise<RadarSyncStatus>
  openInBob: () => Promise<string | null>
  showFolder: () => Promise<string>
  onSyncStatus: (callback: (status: RadarSyncStatus) => void) => () => void
}

export const radarJoinApi: RadarJoinApi = {
  joinWithCode: (code, server) => ipcRenderer.invoke('radar:join-with-code', { code, server }),
  createJoinCode: (member) => ipcRenderer.invoke('radar:create-join-code', member),
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
