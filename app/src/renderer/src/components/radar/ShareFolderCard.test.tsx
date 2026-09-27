// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RadarState } from '@radar/ui'
import type { RadarSyncStatus } from '../../../../shared/radar-join'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useRadarStore } from '@/store/radar-store'
import { ShareFolderCard } from './ShareFolderCard'

const shareFolder = vi.fn()
const stopSharing = vi.fn()
const copyText = vi.fn(async (_text: string) => undefined)
const status: RadarSyncStatus = {
  state: 'syncing',
  folder: null,
  files: 3,
  message: null,
  conflicts: [],
  stopReason: null
}

beforeEach(() => {
  vi.stubGlobal('api', {
    radar: {
      shareFolder,
      stopSharing,
      clearConnection: vi.fn(async () => undefined),
      copyText,
      getSyncStatus: vi.fn(async () => status),
      onSyncStatus: vi.fn(() => () => undefined),
      openInBob: vi.fn(),
      showFolder: vi.fn()
    }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  status.folder = null
  useRadarStore.setState({ connectionFailure: null })
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
  await waitFor(() => expect(copyText).toHaveBeenCalledWith('K7QM-3XPA'))
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
      "Error invoking remote method 'radar:share-folder': Error: Andi is sharing toko-demo. Ask them to stop sharing first, or ask them for a join code."
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
      'Andi is sharing toko-demo. Ask them to stop sharing first, or ask them for a join code.'
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
  await waitFor(() => expect(copyText).toHaveBeenCalledWith('K7QM-3XPA'))

  fireEvent.click(screen.getByRole('button', { name: 'Share a different folder…' }))
  expect(screen.getByText(/This replaces my-app for everyone/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Replace with other' })).toBeTruthy()
  expect(shareFolder).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('region', { name: 'Multiplayer' })).toBeTruthy()
})

it('stops sharing only after the owner confirms, then disconnects', async () => {
  status.folder = '/Users/me/my-app'
  stopSharing.mockResolvedValue(undefined)
  const onConnectionChange = vi.fn()
  render(
    <ShareFolderCard
      connection={owner}
      folder="/Users/me/my-app"
      sharedCode={null}
      onConnectionChange={onConnectionChange}
      onShared={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Stop sharing…' }))
  expect(screen.getByText(/Everyone is disconnected/)).toBeTruthy()
  expect(stopSharing).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }))
  await waitFor(() => expect(onConnectionChange).toHaveBeenCalledWith(null))
  expect(stopSharing).toHaveBeenCalledTimes(1)
})

it('tells the old owner that another device took over, and lets them start over (D-alief-15)', async () => {
  useRadarStore.setState({ connectionFailure: 'signed-out' })
  const onConnectionChange = vi.fn()
  render(
    <ShareFolderCard
      connection={owner}
      folder={null}
      sharedCode={code}
      onConnectionChange={onConnectionChange}
      onShared={vi.fn()}
    />
  )
  expect(await screen.findByText(/Another device took over as owner/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Stop sharing/ })).toBeNull()
  expect(screen.queryByLabelText('Join code')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Forget this workspace' }))
  await waitFor(() => expect(onConnectionChange).toHaveBeenCalledWith(null))
})

it('drops the "Sharing stopped" note once this app joins another workspace', async () => {
  stopSharing.mockResolvedValue(undefined)
  const props = { folder: null, sharedCode: null, onConnectionChange: vi.fn(), onShared: vi.fn() }
  const view = render(<ShareFolderCard connection={owner} {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Stop sharing…' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }))
  view.rerender(<ShareFolderCard connection={null} {...props} />)
  expect(await screen.findByText(/Sharing stopped/)).toBeTruthy()
  view.rerender(
    <ShareFolderCard
      connection={{ server: owner.server, workspace: 'next', member: 'B', role: 'coder' }}
      {...props}
    />
  )
  expect(screen.queryByText(/Sharing stopped/)).toBeNull()
})

it("a teammate sees who is sharing instead of a Share button that always fails", async () => {
  const state = {
    workspace: { id: 'w', name: 'my-app', headCommit: null, repoUrl: null },
    members: {
      A: { id: 'A', name: 'Alief', role: 'coder', color: null, online: true, stale: false, activeTaskId: null, blocked: false, writingUntil: 0 }
    },
    tasks: {}, locks: {}, files: {}, requests: {}, proposals: {}, feed: [], bobActivity: {}, cursor: 0
  } satisfies RadarState
  useRadarStore.setState({ state })
  render(
    <ShareFolderCard
      connection={{ server: owner.server, workspace: 'my-app', member: 'B', role: 'coder' }}
      folder="/Users/me/other"
      sharedCode={null}
      onConnectionChange={vi.fn()}
      onShared={vi.fn()}
    />
  )
  expect(
    await screen.findByText('Alief is sharing my-app. Ask them to stop sharing first, then you can share your own folder.')
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Share/ })).toBeNull()
  useRadarStore.setState({ state: null })
})

it('a joined teammate gets no extra "is sharing" card above their workspace card (fase 12k bug 8)', async () => {
  status.folder = '/Users/me/live-collab/my-app'
  const { container } = render(
    <ShareFolderCard
      connection={{ server: owner.server, workspace: 'my-app', member: 'B', role: 'coder' }}
      folder="/Users/me/live-collab/my-app"
      sharedCode={null}
      onConnectionChange={vi.fn()}
      onShared={vi.fn()}
    />
  )
  await waitFor(() => expect(container.textContent).toBe(''))
})

it('after a restart the owner is told where to make a new join code', async () => {
  status.folder = '/Users/me/my-app'
  render(
    <ShareFolderCard
      connection={owner}
      folder="/Users/me/my-app"
      sharedCode={null}
      onConnectionChange={vi.fn()}
      onShared={vi.fn()}
    />
  )
  expect(await screen.findByText(/click Make code under Invite teammates/)).toBeTruthy()
})

it('drops the "Copied" note when another device takes over as owner', async () => {
  status.folder = '/Users/me/my-app'
  const props = { folder: null, sharedCode: code, onConnectionChange: vi.fn(), onShared: vi.fn() }
  render(<ShareFolderCard connection={owner} {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Copy code' }))
  expect(await screen.findByText(/Copied K7QM-3XPA/)).toBeTruthy()
  act(() => useRadarStore.setState({ connectionFailure: 'signed-out' }))
  expect(await screen.findByText(/Another device took over as owner/)).toBeTruthy()
  expect(screen.queryByText(/Copied K7QM-3XPA/)).toBeNull()
})

it.each([
  ['Share a different folder…', 'Share a different folder?'],
  ['Stop sharing…', 'Stop sharing my-app?']
])(
  'Escape in the %s confirmation closes only the confirmation (fase 12k bug 7)',
  async (trigger, heading) => {
    status.folder = '/Users/me/my-app'
    const onOpenChange = vi.fn()
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>Live Collab</SheetTitle>
          <ShareFolderCard
            connection={owner}
            folder="/Users/me/my-app"
            sharedCode={code}
            onConnectionChange={vi.fn()}
            onShared={vi.fn()}
          />
        </SheetContent>
      </Sheet>
    )
    fireEvent.click(await screen.findByRole('button', { name: trigger }))
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    // Focus moves into the confirmation, so the keyboard stays inside it.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    expect(screen.queryByRole('heading', { name: heading })).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: trigger }))

    // The next Escape closes the panel as usual.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  }
)
