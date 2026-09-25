import { ipcRenderer } from 'electron'
import type {
  RadarConnection,
  RadarConnectionSummary
} from '../../shared/radar-connection'

export type RadarApi = {
  getConnection: () => Promise<RadarConnectionSummary | null>
  setConnection: (connection: RadarConnection) => Promise<RadarConnectionSummary>
  clearConnection: () => Promise<void>
}

export const radarApi: RadarApi = {
  getConnection: () => ipcRenderer.invoke('radar:get-connection'),
  setConnection: (connection) => ipcRenderer.invoke('radar:set-connection', connection),
  clearConnection: () => ipcRenderer.invoke('radar:clear-connection')
}
