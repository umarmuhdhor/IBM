// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RadarSyncStatus } from '../../../../shared/radar-join'
import { ShareFolderCard } from './ShareFolderCard'

const shareFolder = vi.fn()
const writeText = vi.fn(async () => undefined)
const status: RadarSyncStatus = { state: 'syncing', folder: null, files: 3, message: null }

beforeEach(() => {
  vi.stubGlobal('api', {
    radar: {
      shareFolder,
      getSyncStatus: vi.fn(async () => status),
      onSyncStatus: vi.fn(() => () => undefined),
      openInBob: vi.fn(),
      showFolder: vi.fn()
    }
  })
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  status.folder = null
})

const owner = {
  server: 'https://collab.example.dev/',
  workspace: 'my-app',
  member: 'mc',
  role: 'mc' as const
}

it('shares a folder with the name and role, then copies the first code', async () => {
  const code = { member: null, code: 'K7QM-3XPA', expiresAt: 1 }
  shareFolder.mockResolvedValue({ connection: owner, folder: '/p', files: 12, skipped: 0, code })
  const onConnectionChange = vi.fn()
  const onShared = vi.fn()
  render(
    <ShareFolderCard
      connection={null}
      onConnectionChange={onConnectionChange}
      onShared={onShared}
    />
  )
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alief' } })
  fireEvent.click(screen.getByRole('radio', { name: 'PM' }))
  fireEvent.submit(screen.getByRole('form', { name: 'Share a folder' }))

  await waitFor(() => expect(onConnectionChange).toHaveBeenCalledWith(owner))
  expect(shareFolder).toHaveBeenCalledWith('Alief', 'pm', expect.any(String))
  expect(onShared).toHaveBeenCalledWith(code)
  expect(writeText).toHaveBeenCalledWith('K7QM-3XPA')
  expect(await screen.findByText(/Shared 12 files\. Code K7QM-3XPA is copied/)).toBeTruthy()
})

it('does nothing when the owner cancels the folder picker', async () => {
  shareFolder.mockResolvedValue(null)
  const onConnectionChange = vi.fn()
  render(
    <ShareFolderCard connection={null} onConnectionChange={onConnectionChange} onShared={vi.fn()} />
  )
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alief' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Share a folder' }))
  await waitFor(() => expect(shareFolder).toHaveBeenCalled())
  expect(onConnectionChange).not.toHaveBeenCalled()
})

it("shows the server's sentence when the server already has another owner", async () => {
  shareFolder.mockRejectedValue(
    new Error(
      "Error invoking remote method 'radar:share-folder': Error: This server already has the workspace toko-demo. Ask its owner for a join code, or use your own server to share a folder."
    )
  )
  render(<ShareFolderCard connection={null} onConnectionChange={vi.fn()} onShared={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alief' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Share a folder' }))
  expect(
    await screen.findByText(
      'This server already has the workspace toko-demo. Ask its owner for a join code, or use your own server to share a folder.'
    )
  ).toBeTruthy()
})

it("shows the owner's folder and asks before replacing the workspace", async () => {
  status.folder = '/Users/me/my-app'
  render(<ShareFolderCard connection={owner} onConnectionChange={vi.fn()} onShared={vi.fn()} />)
  expect(await screen.findByText('/Users/me/my-app')).toBeTruthy()
  expect(screen.getByText('Syncing 3 files')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Share a different folder…' }))
  expect(screen.getByText(/This replaces my-app for everyone/)).toBeTruthy()
  expect(shareFolder).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('region', { name: 'Your shared folder' })).toBeTruthy()
})
