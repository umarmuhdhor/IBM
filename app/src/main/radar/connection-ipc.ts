import { ipcMain } from 'electron'
import { isRadarConnection } from '../../shared/radar-connection'
import {
  clearRadarConnection,
  getRadarConnectionSummary,
  saveRadarConnection
} from './secure-store'

export function registerRadarConnectionIpc(): void {
  ipcMain.handle('radar:get-connection', () => getRadarConnectionSummary())
  ipcMain.handle('radar:set-connection', (_event, value: unknown) => {
    if (!isRadarConnection(value)) {
      throw new Error('Invalid Live Collab connection')
    }
    saveRadarConnection(value)
    return getRadarConnectionSummary()
  })
  ipcMain.handle('radar:clear-connection', () => clearRadarConnection())
}
