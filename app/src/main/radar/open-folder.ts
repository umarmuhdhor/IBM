import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  mkdirSync
} from 'node:fs'
import { userInfo } from 'node:os'
import { basename, join } from 'node:path'
import {
  ADMIN_FILES_MAX_BATCH_BYTES,
  ADMIN_FILES_MAX_PER_BATCH,
  AdminFilesRes,
  createIgnoreMatcherFromText,
  isProbablyBinary,
  MAX_FILE_BYTES,
  OpenWorkspaceRes
} from '@radar/common'
import { runProcess } from '../../shared/child-process/run-process'
import type { RadarConnection } from '../../shared/radar-connection'
import type { RadarJoinRole, RadarOpenFolderResult } from '../../shared/radar-join'
import { disconnectRadar, startClient } from './connection-ipc'
import { errorMessage, serverOrigin } from './join'
import { ensureNodeForBob } from './node-shim'
import {
  getRadarConnectionSummary,
  readRadarConnection,
  requireOsEncryption,
  saveRadarConnection
} from './secure-store'
import { startSyncAgent } from './sync-agent'
import { readableOrThrow, refuseBroadFolder } from './share-folder-guard'
import { serverFetch } from './server-fetch'
import { readProfileName, saveProfileName } from './profile-name'

// D-alief-12: the owner opens a folder on their own Mac, and that folder becomes the workspace.
// The app uploads it with the Mission Control token, then syncs the same folder as member A.

/** Keeps a server's Durable Object and the first upload small; build output belongs in .gitignore. */
export const MAX_SHARED_FILES = 3000

export type FolderFile = { path: string; content: string }

function readGitignore(dir: string): string | null {
  try {
    return readFileSync(join(dir, '.gitignore'), 'utf8')
  } catch {
    return null
  }
}

/** Files the sync agent would sync: every .gitignore plus R5 §6 defaults, text only, 1 MB each. */
export function collectFolderFiles(root: string): { files: FolderFile[]; skipped: number } {
  const gitignore = readGitignore(root) ?? ''
  const nested: Record<string, string> = {}
  let matcher = createIgnoreMatcherFromText(gitignore)
  const files: FolderFile[] = []
  let skipped = 0
  const walk = (relDir: string): void => {
    // Why: a folder's own .gitignore applies to everything below it (D-alief-16).
    const own = relDir ? readGitignore(join(root, relDir)) : null
    if (own !== null) {
      nested[relDir] = own
      matcher = createIgnoreMatcherFromText(gitignore, nested)
    }
    const entries = readdirSync(join(root, relDir), { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (!matcher.ignores(`${rel}/`)) {
          walk(rel)
        }
        continue
      }
      // Why: symlinks and sockets are not synced by the agent either.
      if (!entry.isFile() || matcher.ignores(rel)) {
        continue
      }
      const bytes = readFileSync(join(root, rel))
      if (bytes.byteLength > MAX_FILE_BYTES || isProbablyBinary(bytes)) {
        skipped++
        continue
      }
      files.push({ path: rel, content: bytes.toString('utf8') })
      if (files.length > MAX_SHARED_FILES) {
        throw new Error(
          `This folder has more than ${MAX_SHARED_FILES} files to share. Add build output to .gitignore or pick a smaller folder.`
        )
      }
    }
  }
  walk('')
  return { files, skipped }
}

/** Batches for `/v1/workspace/files`: at most 100 files and 4 MB each. */
export function batchFolderFiles(files: readonly FolderFile[]): FolderFile[][] {
  const batches: FolderFile[][] = []
  let current: FolderFile[] = []
  let bytes = 0
  for (const file of files) {
    const size = Buffer.byteLength(file.content, 'utf8')
    if (
      current.length > 0 &&
      (current.length >= ADMIN_FILES_MAX_PER_BATCH || bytes + size > ADMIN_FILES_MAX_BATCH_BYTES)
    ) {
      batches.push(current)
      current = []
      bytes = 0
    }
    current.push(file)
    bytes += size
  }
  if (current.length > 0) {
    batches.push(current)
  }
  return batches
}

/** Folder name as a workspace name: lowercase letters, digits, dot, dash and underscore. */
export function workspaceNameFor(folder: string): string {
  const slug = basename(folder)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 64)
  return slug || 'workspace'
}

type OwnerFolder = { workspace: string; folder: string }

function ownerFolderPath(): string {
  return join(app.getPath('userData'), 'radar', 'owner-folder.json')
}

function readOwnerFolder(): OwnerFolder | null {
  try {
    const value: unknown = JSON.parse(readFileSync(ownerFolderPath(), 'utf8'))
    if (
      typeof value === 'object' &&
      value !== null &&
      'workspace' in value &&
      typeof value.workspace === 'string' &&
      'folder' in value &&
      typeof value.folder === 'string'
    ) {
      return { workspace: value.workspace, folder: value.folder }
    }
  } catch {
    // Missing or unreadable: nothing to resume.
  }
  return null
}

function saveOwnerFolder(value: OwnerFolder): void {
  mkdirSync(join(app.getPath('userData'), 'radar'), { recursive: true })
  writeFileSync(ownerFolderPath(), JSON.stringify(value))
}

/** First share without a saved name: git's user.name, else the macOS account name. */
export async function ownerName(folder: string): Promise<string> {
  const git = await runProcess({
    program: 'git',
    args: ['-C', folder, 'config', '--get', 'user.name'],
    timeoutMs: 5_000
  }).catch(() => null)
  const fromGit = git?.code === 0 ? git.stdout.trim().slice(0, 100) : ''
  if (fromGit) {
    return fromGit
  }
  try {
    return userInfo().username.slice(0, 100) || 'Owner'
  } catch {
    return 'Owner'
  }
}

/**
 * Makes `folder` the workspace on the server and shares it. On a server that already has a workspace,
 * only its current owner (a Mission Control connection) may do this, and it replaces everything there.
 */
export async function shareFolder(
  folder: string,
  nameInput: unknown,
  roleInput: unknown,
  serverInput: unknown
): Promise<RadarOpenFolderResult> {
  refuseBroadFolder(folder)
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error('That folder no longer exists.')
  }
  const name =
    saveProfileName(nameInput) ??
    readProfileName() ??
    saveProfileName(await ownerName(folder)) ??
    'Owner'
  const role: RadarJoinRole = roleInput === 'pm' ? 'pm' : 'coder'
  requireOsEncryption()
  const current = readRadarConnection()
  const server = current?.role === 'mc' ? new URL(current.server).origin : serverOrigin(serverInput)
  const { files, skipped } = readableOrThrow(() => collectFolderFiles(folder))
  const workspace = workspaceNameFor(folder)

  const opened = await serverFetch(`${server}/v1/workspace/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(current?.role === 'mc' ? { Authorization: `Bearer ${current.token}` } : {})
    },
    body: JSON.stringify({ workspace, owner: { name, role } }),
    signal: AbortSignal.timeout(15_000)
  })
  if (!opened.ok) {
    throw new Error(await errorMessage(opened))
  }
  const res = OpenWorkspaceRes.parse(await opened.json())
  for (const batch of batchFolderFiles(files)) {
    const uploaded = await serverFetch(`${server}/v1/workspace/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${res.mcToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ headCommit: null, files: batch }),
      signal: AbortSignal.timeout(30_000)
    })
    if (!uploaded.ok) {
      throw new Error(await errorMessage(uploaded))
    }
    AdminFilesRes.parse(await uploaded.json())
  }

  const connection: RadarConnection = {
    server: `${server}/`,
    workspace: res.workspace,
    member: 'mc',
    role: 'mc',
    token: res.mcToken
  }
  saveRadarConnection(connection)
  startClient(connection)
  saveOwnerFolder({ workspace: res.workspace, folder })
  // Why: the server already holds these files, so the first snapshot rewrites nothing in the folder.
  startSyncAgent(res.workspace, res.invite, folder)
  await ensureNodeForBob().catch(() => undefined)
  const summary = getRadarConnectionSummary()
  if (!summary) {
    throw new Error('Connection could not be saved')
  }
  return {
    connection: summary,
    folder,
    files: files.length,
    skipped,
    code: { member: null, code: res.code, expiresAt: res.expiresAt }
  }
}

/**
 * The owner stops sharing (D-alief-12): the server removes the workspace and closes every socket, so it is empty
 * for whoever shares a folder next. This Mac forgets the connection; the folder and its files stay.
 */
export async function stopSharing(): Promise<void> {
  const connection = readRadarConnection()
  if (!connection || connection.role !== 'mc') {
    throw new Error('Only the workspace owner can stop sharing.')
  }
  const response = await serverFetch(new URL('/v1/workspace/close', connection.server).toString(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${connection.token}` },
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
  disconnectRadar()
  rmSync(ownerFolderPath(), { force: true })
}

async function chooseAndShare(
  window: BrowserWindow | null,
  value: unknown
): Promise<RadarOpenFolderResult | null> {
  const field = (key: string): unknown =>
    typeof value === 'object' && value !== null && key in value ? Reflect.get(value, key) : null
  // The folder open in the app is shared as is; the picker is only for a folder that is not open.
  const given = field('folder')
  if (typeof given === 'string' && given) {
    return shareFolder(given, field('name'), field('role'), field('server'))
  }
  const options: Electron.OpenDialogOptions = {
    title: 'Choose the project folder to share',
    buttonLabel: 'Share this folder',
    properties: ['openDirectory', 'createDirectory']
  }
  const picked = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  const folder = picked.canceled ? undefined : picked.filePaths[0]
  if (!folder) {
    return null
  }
  return shareFolder(folder, field('name'), field('role'), field('server'))
}

export function registerRadarOpenFolderIpc(): void {
  // The owner's folder keeps syncing after a restart while the app is still its Mission Control.
  void app.whenReady().then(() => {
    try {
      const saved = readRadarConnection()
      const owned = readOwnerFolder()
      if (
        saved?.role === 'mc' &&
        owned?.workspace === saved.workspace &&
        existsSync(join(owned.folder, '.radar', 'local.json'))
      ) {
        startSyncAgent(owned.workspace, null, owned.folder)
      } else if (owned && saved?.role !== 'mc') {
        rmSync(ownerFolderPath(), { force: true })
      }
    } catch (error) {
      // A locked keychain must not prevent the app from starting.
      console.warn(
        '[radar] could not resume owner folder:',
        error instanceof Error ? error.message : error
      )
    }
  })
  ipcMain.handle('radar:stop-sharing', () => stopSharing())
  ipcMain.handle('radar:share-folder', (event, value: unknown) =>
    chooseAndShare(BrowserWindow.fromWebContents(event.sender), value)
  )
}
