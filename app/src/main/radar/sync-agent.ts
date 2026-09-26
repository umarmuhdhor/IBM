import { app, BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnProcess } from '../../shared/child-process/run-process'
import type { RadarSyncStatus } from '../../shared/radar-join'

// Why: teammates who join with a code have no Node or npm. The radar CLI ships inside the app
// (resources/radar-cli, built by config/scripts/build-radar-cli.mjs) and runs on the app's own
// Electron binary in Node mode, so the sync agent needs nothing else installed.

let child: ReturnType<typeof spawnProcess> | null = null
let status: RadarSyncStatus = { state: 'stopped', folder: null, files: null, message: null }

export function radarCliDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'radar-cli')
    : join(app.getAppPath(), 'resources', 'radar-cli')
}

export function workspaceFolder(workspace: string): string {
  return join(homedir(), 'live-collab', workspace)
}

export function getSyncStatus(): RadarSyncStatus {
  return status
}

function publish(next: Partial<RadarSyncStatus>): void {
  status = { ...status, ...next }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('radar:sync', status)
    }
  }
}

function handleLine(line: string): void {
  if (!line.startsWith('{')) {
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    // Non-JSON output (kit install notes) is informational only.
    return
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('type' in parsed) ||
    parsed.type !== 'status'
  ) {
    return
  }
  const connected = 'connected' in parsed && parsed.connected === true
  const files = 'files' in parsed && typeof parsed.files === 'number' ? parsed.files : status.files
  publish({
    state: connected ? 'syncing' : 'starting',
    files,
    message: connected ? null : 'Reconnecting to the server'
  })
}

export function stopSyncAgent(): void {
  const running = child
  child = null
  if (running && running.exitCode === null) {
    running.kill('SIGTERM')
  }
  publish({ state: 'stopped', files: null, message: null })
}

/**
 * Starts `radar join` (with an invite, first time) or `radar start` (folder already joined) for the
 * folder of `workspace`. The invite travels in the child's environment, never in argv or logs.
 */
export function startSyncAgent(workspace: string, invite: string | null): void {
  stopSyncAgent()
  const folder = workspaceFolder(workspace)
  const cli = join(radarCliDir(), 'dist', 'radar.mjs')
  if (!existsSync(cli)) {
    publish({ state: 'error', folder, message: 'Bundled radar CLI is missing. Reinstall the app.' })
    return
  }
  if (!invite && !existsSync(join(folder, '.radar', 'local.json'))) {
    publish({ state: 'stopped', folder, message: 'Join with a code to sync this workspace.' })
    return
  }
  const args = invite
    ? [cli, 'join', '--dir', folder, '--json-status', '--kit-dir', join(radarCliDir(), 'bob-kit')]
    : [cli, 'start', '--dir', folder, '--json-status']
  const env: NodeJS.ProcessEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  delete env.RADAR_INVITE
  if (invite) {
    env.RADAR_INVITE = invite
  }
  publish({ state: 'starting', folder, files: null, message: null })
  const proc = spawnProcess({ program: process.execPath, args, env, timeoutMs: null })
  child = proc
  let buffer = ''
  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(handleLine)
  })
  let lastError = ''
  proc.stderr.setEncoding('utf8')
  proc.stderr.on('data', (chunk: string) => {
    // Why: keep only the last line; the CLI never prints tokens, but stay short anyway.
    lastError = chunk.trim().split('\n').pop()?.slice(0, 300) ?? lastError
  })
  proc.on('error', (error) => {
    lastError = error.message
  })
  proc.on('exit', (code) => {
    if (child !== proc) {
      return
    }
    child = null
    publish({
      state: code === 0 ? 'stopped' : 'error',
      message: code === 0 ? null : lastError.replace(/^✖\s*/, '') || `Sync stopped (exit ${code})`
    })
  })
}
