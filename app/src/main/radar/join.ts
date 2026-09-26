import { ipcMain, app, shell } from 'electron'
import { existsSync } from 'node:fs'
import { AdminJoinCodeRes, decodeInvite, ErrorRes, JoinRes, normalizeJoinCode } from '@radar/common'
import { runProcess } from '../../shared/child-process/run-process'
import type { RadarConnection } from '../../shared/radar-connection'
import {
  DEFAULT_RADAR_SERVER,
  type RadarJoinCode,
  type RadarJoinResult
} from '../../shared/radar-join'
import { startClient } from './connection-ipc'
import { ensureNodeForBob } from './node-shim'
import {
  getRadarConnectionSummary,
  readRadarConnection,
  requireOsEncryption,
  saveRadarConnection
} from './secure-store'
import { getSyncStatus, startSyncAgent, stopSyncAgent, workspaceFolder } from './sync-agent'

function serverOrigin(value: unknown): string {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_RADAR_SERVER
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid Live Collab server URL')
  }
  return url.origin
}

async function errorMessage(response: Response): Promise<string> {
  const parsed = ErrorRes.safeParse(await response.json().catch(() => null))
  return parsed.success
    ? parsed.data.error.message
    : `Live Collab request failed (${response.status})`
}

/** Redeems a join code, stores the member connection, starts the WebSocket client and the sync agent. */
export async function joinWithCode(
  codeInput: unknown,
  serverInput: unknown
): Promise<RadarJoinResult> {
  const code = typeof codeInput === 'string' ? normalizeJoinCode(codeInput) : null
  if (!code) {
    throw new Error('A join code looks like K7QM-3XPA.')
  }
  const server = serverOrigin(serverInput)
  // Why: redeeming rotates the member's token, so fail before that if the new one cannot be stored.
  requireOsEncryption()
  const response = await fetch(`${server}/v1/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
  const res = JoinRes.parse(await response.json())
  const invite = decodeInvite(res.invite)
  // Why: the app's connection model knows coder and mc only; a PM member uses the member socket too.
  const connection: RadarConnection = {
    server: `${new URL(invite.server).origin}/`,
    workspace: invite.workspace,
    member: invite.member,
    role: 'coder',
    token: invite.token
  }
  saveRadarConnection(connection)
  startClient(connection)
  startSyncAgent(invite.workspace, res.invite)
  await ensureNodeForBob().catch(() => undefined)
  const summary = getRadarConnectionSummary()
  if (!summary) {
    throw new Error('Connection could not be saved')
  }
  return {
    connection: summary,
    role: res.role,
    folder: workspaceFolder(invite.workspace)
  }
}

/** Mission Control only: a code a teammate types into their app (or `curl <server>/j/<code> | sh`). */
export async function createJoinCode(memberInput: unknown): Promise<RadarJoinCode> {
  const connection = readRadarConnection()
  if (!connection || connection.role !== 'mc') {
    throw new Error('Connect as Mission Control to make join codes.')
  }
  if (typeof memberInput !== 'string' || !memberInput.trim()) {
    throw new Error('Pick a member first.')
  }
  const response = await fetch(new URL('/v1/join-codes', connection.server).toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ member: memberInput.trim() }),
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
  return AdminJoinCodeRes.parse(await response.json())
}

async function openInBob(): Promise<string | null> {
  const folder = getSyncStatus().folder
  if (!folder || !existsSync(folder)) {
    return 'Join a workspace first.'
  }
  if (process.platform !== 'darwin') {
    return shell.openPath(folder).then(() => 'Open this folder in IBM Bob IDE.')
  }
  return runProcess({
    program: '/usr/bin/open',
    args: ['-a', 'IBM Bob', folder],
    timeoutMs: 10_000
  }).then(async (result) => {
    if (result.code === 0) {
      return null
    }
    // Why: without IBM Bob installed, show the folder so the user can open it in any editor.
    await shell.openPath(folder)
    return 'IBM Bob IDE was not found. The folder opened in Finder instead.'
  })
}

export function registerRadarJoinIpc(): void {
  // A member connection made earlier resumes syncing its folder once Electron is ready.
  void app.whenReady().then(() => {
    try {
      const saved = readRadarConnection()
      if (saved && saved.role === 'coder' && existsSync(workspaceFolder(saved.workspace))) {
        startSyncAgent(saved.workspace, null)
      }
    } catch (error) {
      // A locked keychain must not prevent the app from starting.
      console.warn('[radar] could not resume sync:', error instanceof Error ? error.message : error)
    }
  })
  app.on('before-quit', () => stopSyncAgent())
  ipcMain.handle('radar:join-with-code', (_event, value: unknown) => {
    const code = typeof value === 'object' && value !== null && 'code' in value ? value.code : null
    const server =
      typeof value === 'object' && value !== null && 'server' in value ? value.server : null
    return joinWithCode(code, server)
  })
  ipcMain.handle('radar:create-join-code', (_event, member: unknown) => createJoinCode(member))
  ipcMain.handle('radar:sync-status', () => getSyncStatus())
  ipcMain.handle('radar:open-in-bob', () => openInBob())
  ipcMain.handle('radar:show-folder', () => {
    const folder = getSyncStatus().folder
    return folder ? shell.openPath(folder) : Promise.resolve('Join a workspace first.')
  })
}
