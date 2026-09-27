import { expect, it } from 'vitest'
import type { RadarSyncStatus } from '../../../../shared/radar-join'
import { endedNotice, syncLine } from './use-radar-sync-status'

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

it('tells a removed member calmly where their files are and how to come back (D-alief-20)', () => {
  const stopped: RadarSyncStatus = { ...syncing(null), state: 'stopped', stopReason: 'removed' }
  const text = 'The owner removed you from this workspace. Your files stay in /p/app. Ask the owner for a new code to join again.'
  expect(endedNotice(stopped, null)).toBe(text)
  // The app socket may report it before the sync agent does.
  expect(endedNotice({ ...syncing(null), state: 'stopped' }, 'removed')).toBe(text)
})
