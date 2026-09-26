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
const code = { member: null, code: 'K7QM-3XPA', expiresAt: 1 }

it('shares the folder open in the app with one click and copies the code', async () => {
  shareFolder.mockResolvedValue({
    connection: owner,
    folder: '/Users/me/my-app',
    files: 12,
    skipped: 0,
    code
  })
  const onConnectionChange = vi.fn()
  const onShared = vi.fn()
  render(
    <ShareFolderCard
      connection={null}
      folder="/Users/me/my-app"
      sharedCode={null}
      onConnectionChange={onConnectionChange}
      onShared={onShared}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Share my-app' }))

  await waitFor(() => expect(onConnectionChange).toHaveBeenCalledWith(owner))
  expect(shareFolder).toHaveBeenCalledWith('/Users/me/my-app', expect.any(String))
  expect(onShared).toHaveBeenCalledWith(code)
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('K7QM-3XPA'))
})

it('opens the folder picker when no folder is open', async () => {
  shareFolder.mockResolvedValue(null)
  const onConnectionChange = vi.fn()
  render(
    <ShareFolderCard
      connection={null}
      folder={null}
      sharedCode={null}
      onConnectionChange={onConnectionChange}
      onShared={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Choose folder and share…' }))
  await waitFor(() => expect(shareFolder).toHaveBeenCalledWith(null, expect.any(String)))
  expect(onConnectionChange).not.toHaveBeenCalled()
})

it("shows the server's sentence when the server already has another owner", async () => {
  shareFolder.mockRejectedValue(
    new Error(
      "Error invoking remote method 'radar:share-folder': Error: This server already has the workspace toko-demo. Ask its owner for a join code, or use your own server to share a folder."
    )
  )
  render(
    <ShareFolderCard
      connection={null}
      folder="/p/app"
      sharedCode={null}
      onConnectionChange={vi.fn()}
      onShared={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Share app' }))
  expect(
    await screen.findByText(
      'This server already has the workspace toko-demo. Ask its owner for a join code, or use your own server to share a folder.'
    )
  ).toBeTruthy()
})

it('shows the shared folder with its code, and asks before replacing the workspace', async () => {
  status.folder = '/Users/me/my-app'
  render(
    <ShareFolderCard
      connection={owner}
      folder="/Users/me/other"
      sharedCode={code}
      onConnectionChange={vi.fn()}
      onShared={vi.fn()}
    />
  )
  expect(await screen.findByText('my-app is shared')).toBeTruthy()
  expect(screen.getByLabelText('Join code').textContent).toBe('K7QM-3XPA')
  fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('K7QM-3XPA'))

  fireEvent.click(screen.getByRole('button', { name: 'Share a different folder…' }))
  expect(screen.getByText(/This replaces my-app for everyone/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Replace with other' })).toBeTruthy()
  expect(shareFolder).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('region', { name: 'Multiplayer' })).toBeTruthy()
})
