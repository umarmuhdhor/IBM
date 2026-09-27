import { describe, expect, it, vi } from 'vitest'
import type { RadarSyncStatus } from '../../shared/radar-join'

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/app' },
  BrowserWindow: { getAllWindows: () => [] }
}))
vi.mock('../../shared/child-process/run-process', () => ({ spawnProcess: vi.fn() }))

const { applySyncLine, cliErrorText, getSyncStatus, startSyncAgent, stopSyncAgent } =
  await import('./sync-agent')

const BASE: RadarSyncStatus = {
  state: 'starting',
  folder: '/f',
  files: null,
  message: null,
  conflicts: [],
  stopReason: null
}

describe('applySyncLine', () => {
  it('turns status lines into syncing or reconnecting', () => {
    expect(applySyncLine(BASE, '{"type":"status","connected":true,"files":3}')).toMatchObject({
      state: 'syncing',
      files: 3,
      message: null
    })
    expect(applySyncLine(BASE, '{"type":"status","connected":false}')).toMatchObject({
      state: 'starting',
      message: 'Reconnecting to the server'
    })
    expect(applySyncLine(BASE, '✓ kit coder installed')).toBeNull()
  })

  it('keeps the latest reason a change was not sent, e.g. a PM edit', () => {
    const line = JSON.stringify({
      type: 'rejected',
      path: 'notes.md',
      reason: 'pm_readonly',
      sidecar: 'notes.md.radar-rejected',
      message: '\u0007✖ A PM does not write files. Your change is kept in notes.md.radar-rejected.'
    })
    expect(applySyncLine(BASE, line)?.rejected).toBe(
      'A PM does not write files. Your change is kept in notes.md.radar-rejected.'
    )
  })

  it('drops the notice once the server accepts that file after all, not for another file (fase 12k)', () => {
    const rejected = applySyncLine(
      BASE,
      JSON.stringify({ type: 'rejected', path: 'app.ts', reason: 'locked', message: 'app.ts is locked.' })
    )
    expect(rejected?.rejected).toBe('app.ts is locked.')
    expect(applySyncLine(rejected ?? BASE, JSON.stringify({ type: 'accepted', path: 'other.ts' }))).toBeNull()
    expect(applySyncLine(rejected ?? BASE, JSON.stringify({ type: 'accepted', path: 'app.ts' }))).toMatchObject({
      rejected: null
    })
  })

  it('keeps a refused or missing Bob kit and clears it once installed (fase 12k bug 4)', () => {
    const refused = applySyncLine(
      BASE,
      JSON.stringify({
        type: 'kit',
        status: 'refused',
        role: 'coder',
        foreign: ['.bob/x'],
        message: 'Bob kit not installed.'
      })
    )
    expect(refused?.kit).toEqual({ status: 'refused', message: 'Bob kit not installed.' })
    expect(applySyncLine(refused!, '{"type":"kit","status":"installed","message":"ok"}')?.kit).toBeNull()
    expect(applySyncLine(BASE, '{"type":"kit","status":"other"}')).toBeNull()
  })

  it('lists each file kept as .radar-conflict once (D-alief-14)', () => {
    const line = '{"type":"conflict","path":"notes/a.md","sidecar":"notes/a.md.radar-conflict"}'
    const once = applySyncLine(BASE, line)
    expect(once?.conflicts).toEqual(['notes/a.md'])
    expect(applySyncLine(once!, line)).toBeNull()
  })

  it('keeps why sync stopped, so the app can show a friendly state (D-alief-15)', () => {
    const line =
      '{"type":"stopped","reason":"workspace-closed","message":"The owner stopped sharing this workspace."}'
    expect(applySyncLine({ ...BASE, state: 'syncing' }, line)).toMatchObject({
      state: 'stopped',
      stopReason: 'workspace-closed',
      message: 'The owner stopped sharing this workspace.'
    })
    expect(
      applySyncLine(BASE, '{"type":"stopped","reason":"removed","message":"The workspace owner removed you, so sync stopped."}')
    ).toMatchObject({ state: 'stopped', stopReason: 'removed' })
    expect(applySyncLine(BASE, '{"type":"stopped","reason":"other"}')).toMatchObject({
      state: 'error',
      stopReason: null
    })
  })
})

describe('cliErrorText', () => {
  it('drops the terminal bell, colors and the cross mark', () => {
    expect(cliErrorText('\u0007\u001b[31m✖ Sync stopped: token rejected\u001b[39m')).toBe(
      'Sync stopped: token rejected'
    )
  })
})

describe('stopSyncAgent', () => {
  it('forgets the folder, so the old owner is offered Share again', () => {
    // No bundled CLI under /app in tests, so this only records the folder.
    startSyncAgent('my-app', null, '/Users/me/my-app')
    expect(getSyncStatus().folder).toBe('/Users/me/my-app')
    stopSyncAgent()
    expect(getSyncStatus()).toMatchObject({ state: 'stopped', folder: null })
  })
})
