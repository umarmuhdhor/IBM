import { expect, it } from 'vitest'
import type { RadarSyncStatus } from '../../../../shared/radar-join'
import { syncLine } from './use-radar-sync-status'

const syncing = (files: number | null): RadarSyncStatus => ({
  state: 'syncing',
  folder: '/p/app',
  files,
  message: null,
  conflicts: [],
  stopReason: null
})

it('counts files in plain English', () => {
  expect(syncLine(syncing(1))).toBe('Syncing 1 file')
  expect(syncLine(syncing(3))).toBe('Syncing 3 files')
  expect(syncLine(syncing(null))).toBe('Syncing 0 files')
})
