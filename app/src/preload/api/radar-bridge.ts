import { ipcRenderer } from 'electron'
import type { RadarConnection, RadarConnectionSummary } from '../../shared/radar-connection'
import type { RadarWsUpdate } from '../../shared/radar-update'

export type RadarApi = {
  getConnection: () => Promise<RadarConnectionSummary | null>
  refresh: () => Promise<void>
  setConnection: (connection: RadarConnection) => Promise<RadarConnectionSummary>
  clearConnection: () => Promise<void>
  decide: (id: string, approve: boolean, note: string) => Promise<void>
  revoke: (path: string, reason: string) => Promise<void>
  cancelTask: (id: string) => Promise<void>
  onUpdate: (callback: (update: RadarWsUpdate) => void) => () => void
}

export const radarApi: RadarApi = {
  getConnection: () => ipcRenderer.invoke('radar:get-connection'),
  refresh: () => ipcRenderer.invoke('radar:refresh'),
  setConnection: (connection) => ipcRenderer.invoke('radar:set-connection', connection),
  clearConnection: () => ipcRenderer.invoke('radar:clear-connection'),
  decide: (id, approve, note) => ipcRenderer.invoke('radar:decide', { id, approve, note }),
  revoke: (path, reason) => ipcRenderer.invoke('radar:revoke', { path, reason }),
  cancelTask: (id) => ipcRenderer.invoke('radar:cancel-task', { id }),
  onUpdate: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, update: RadarWsUpdate): void =>
      callback(update)
    ipcRenderer.on('radar:update', listener)
    return () => ipcRenderer.removeListener('radar:update', listener)
  }
}
