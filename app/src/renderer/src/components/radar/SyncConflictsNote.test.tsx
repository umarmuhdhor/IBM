// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { RadarSyncStatus } from '../../../../shared/radar-join'
import { SyncConflictsNote } from './SyncConflictsNote'

const base: RadarSyncStatus = {
  state: 'syncing',
  folder: '/Users/me/live-collab/shop',
  files: 3,
  message: null,
  conflicts: [],
  stopReason: null
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('says why a binary or too-large file does not sync (fase 12k bug 2)', () => {
  const rejected = 'logo.png is a binary file and does not sync.'
  render(<SyncConflictsNote sync={{ ...base, rejected }} />)
  expect(screen.getByText('logo.png is a binary file and does not sync.')).toBeTruthy()
})

it('explains a refused Bob kit and installs it with a backup on request (fase 12k bug 4)', async () => {
  const installBobKit = vi.fn(async () => undefined)
  vi.stubGlobal('api', { radar: { installBobKit } })
  const message =
    "Bob kit not installed: this folder's .bob/ already has other files (.bob/notes.md). Installing it moves your current .bob/ to a backup folder .bob.bak-<time> first, so nothing is lost."
  render(<SyncConflictsNote sync={{ ...base, kit: { status: 'refused', message } }} />)
  expect(screen.getByText(message)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Back up .bob and install the Bob kit' }))
  expect(installBobKit).toHaveBeenCalledTimes(1)
  expect(await screen.findByText(/Installing/)).toBeTruthy()
})

it('shows why the kit install failed instead of hiding it', async () => {
  const installBobKit = vi.fn(async () => {
    throw new Error('disk full')
  })
  vi.stubGlobal('api', { radar: { installBobKit } })
  const kit = { status: 'refused', message: 'Bob kit not installed.' } as const
  render(<SyncConflictsNote sync={{ ...base, kit }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Back up .bob and install the Bob kit' }))
  expect(await screen.findByText(/Could not install the Bob kit: disk full/)).toBeTruthy()
})

it('a missing kit has no install button', () => {
  const kit = { status: 'missing-kit', message: 'Bob kit not found in the app.' } as const
  render(<SyncConflictsNote sync={{ ...base, kit }} />)
  expect(screen.getByText('Bob kit not found in the app.')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

it('drops the old install error when a new kit notice arrives', async () => {
  const installBobKit = vi.fn(async () => {
    throw new Error('disk full')
  })
  vi.stubGlobal('api', { radar: { installBobKit } })
  const kit = { status: 'refused', message: 'Bob kit not installed.' } as const
  const view = render(<SyncConflictsNote sync={{ ...base, kit }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Back up .bob and install the Bob kit' }))
  expect(await screen.findByText(/Could not install the Bob kit/)).toBeTruthy()
  view.rerender(<SyncConflictsNote sync={{ ...base, kit: { status: 'missing-kit', message: 'Bob kit not found in the app.' } }} />)
  expect(screen.queryByText(/Could not install the Bob kit/)).toBeNull()
})
