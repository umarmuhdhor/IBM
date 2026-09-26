import { describe, expect, it, vi } from 'vitest'
import type { RadarSyncStatus } from '../../shared/radar-join'

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/app' },
  BrowserWindow: { getAllWindows: () => [] }
}))
vi.mock('../../shared/child-process/run-process', () => ({ spawnProcess: vi.fn() }))

const { applySyncLine } = await import('./sync-agent')

const BASE: RadarSyncStatus = {
  state: 'starting',
  folder: '/f',
  files: null,
  message: null,
  conflicts: []
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

  it('lists each file kept as .radar-conflict once (D-alief-14)', () => {
    const line = '{"type":"conflict","path":"notes/a.md","sidecar":"notes/a.md.radar-conflict"}'
    const once = applySyncLine(BASE, line)
    expect(once?.conflicts).toEqual(['notes/a.md'])
    expect(applySyncLine(once!, line)).toBeNull()
  })
})
