import { BrowserWindow, ipcMain } from 'electron'
import { isRadarConnection } from '../../shared/radar-connection'
import type { RadarConnection } from '../../shared/radar-connection'
import type { RadarWsUpdate } from '../../shared/radar-update'
import { cancelTask, decideProposal, revokeLock } from './api'
import { runRadarChecks } from './checks'
import {
  clearRadarConnection,
  getRadarConnectionSummary,
  readRadarConnection,
  saveRadarConnection
} from './secure-store'
import { RadarWsClient } from './ws-client'

let activeClient: RadarWsClient | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function publishUpdate(update: RadarWsUpdate): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('radar:update', update)
    }
  }
}

function stopClient(): void {
  activeClient?.disconnect()
  activeClient = null
}

function startClient(connection: RadarConnection): void {
  stopClient()
  activeClient = new RadarWsClient(connection, publishUpdate)
  activeClient.connect()
}

export function registerRadarConnectionIpc(): void {
  try {
    const saved = readRadarConnection()
    if (saved) {
      startClient(saved)
    }
  } catch {
    // A locked keychain or corrupt file must not prevent the desktop app from starting.
    publishUpdate({ kind: 'status', connected: false })
  }
  ipcMain.handle('radar:get-connection', () => getRadarConnectionSummary())
  ipcMain.handle('radar:refresh', () => {
    const saved = readRadarConnection()
    if (saved) {
      startClient(saved)
    }
  })
  ipcMain.handle('radar:set-connection', (_event, value: unknown) => {
    if (!isRadarConnection(value)) {
      throw new Error('Invalid Live Collab connection')
    }
    saveRadarConnection(value)
    startClient(value)
    return getRadarConnectionSummary()
  })
  ipcMain.handle('radar:clear-connection', () => {
    stopClient()
    clearRadarConnection()
  })
  ipcMain.handle('radar:checks', (_event, workspacePath: unknown) =>
    runRadarChecks(typeof workspacePath === 'string' ? workspacePath : null)
  )
  ipcMain.handle('radar:decide', (_event, value: unknown) => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.approve !== 'boolean' ||
      typeof value.note !== 'string'
    ) {
      throw new Error('Invalid Live Collab decision')
    }
    return decideProposal(value.id, value.approve, value.note)
  })
  ipcMain.handle('radar:revoke', (_event, value: unknown) => {
    if (!isRecord(value) || typeof value.path !== 'string' || typeof value.reason !== 'string') {
      throw new Error('Invalid Live Collab revoke request')
    }
    return revokeLock(value.path, value.reason)
  })
  ipcMain.handle('radar:cancel-task', (_event, value: unknown) => {
    if (!isRecord(value) || typeof value.id !== 'string') {
      throw new Error('Invalid Live Collab task')
    }
    return cancelTask(value.id)
  })
}
