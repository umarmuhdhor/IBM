import { BrowserWindow, ipcMain } from 'electron'
import { isRadarConnection } from '../../shared/radar-connection'
import type { RadarConnection } from '../../shared/radar-connection'
import type { RadarWsUpdate } from '../../shared/radar-update'
import { cancelTask, decideProposal, revokeLock, setTaskStep, submitTask } from './api'
import { runRadarChecks } from './checks'
import { readSharePrompts, writeSharePrompts } from './share-prompts'
import {
  clearRadarConnection,
  getRadarConnectionSummary,
  readRadarConnection,
  saveRadarConnection
} from './secure-store'
import { stopSyncAgent } from './sync-agent'
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

export function startClient(connection: RadarConnection): void {
  stopClient()
  activeClient = new RadarWsClient(connection, publishUpdate)
  activeClient.connect()
}

/** Forgets the saved connection on this Mac and stops the socket and the sync agent. */
export function disconnectRadar(): void {
  stopClient()
  stopSyncAgent()
  clearRadarConnection()
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
  ipcMain.handle('radar:clear-connection', () => disconnectRadar())
  ipcMain.handle('radar:checks', (_event, workspacePath: unknown) =>
    runRadarChecks(typeof workspacePath === 'string' ? workspacePath : null)
  )
  ipcMain.handle('radar:get-share-prompts', (_event, workspacePath: unknown) => {
    if (typeof workspacePath !== 'string') {
      throw new Error('Invalid Live Collab workspace path')
    }
    return readSharePrompts(workspacePath)
  })
  ipcMain.handle('radar:set-share-prompts', (_event, value: unknown) => {
    if (
      !isRecord(value) ||
      typeof value.workspacePath !== 'string' ||
      typeof value.enabled !== 'boolean'
    ) {
      throw new Error('Invalid Live Collab share prompts request')
    }
    return writeSharePrompts(value.workspacePath, value.enabled)
  })
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
  ipcMain.handle('radar:set-task-step', (_event, value: unknown) => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.index !== 'number' ||
      typeof value.done !== 'boolean'
    ) {
      throw new Error('Invalid Live Collab task step')
    }
    return setTaskStep(value.id, value.index, value.done)
  })
  ipcMain.handle('radar:submit-task', (_event, value: unknown) => {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.summary !== 'string') {
      throw new Error('Invalid Live Collab task submit')
    }
    return submitTask(value.id, value.summary)
  })
}
