// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RadarSyncStatus } from '../../../../shared/radar-join'
import type { RadarState } from '@radar/ui'
import { useRadarStore } from '@/store/radar-store'
import { JoinWithCodeCard } from './JoinWithCodeCard'

const status: RadarSyncStatus = {
  state: 'error',
  folder: '/Users/me/live-collab/old',
  files: null,
  message: 'Workspace reset',
  conflicts: [],
  stopReason: null
}

beforeEach(() => {
  vi.stubGlobal('api', {
    radar: {
      getSyncStatus: vi.fn(async () => status),
      onSyncStatus: vi.fn(() => () => undefined),
      joinWithCode: vi.fn(),
      getProfileName: vi.fn(async () => 'Alief'),
      openInBob: vi.fn(),
      showFolder: vi.fn()
    }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  status.conflicts = []
  status.state = 'error'
  status.message = 'Workspace reset'
  status.stopReason = null
})

const member = {
  server: 'https://collab.example.dev/',
  workspace: 'old',
  member: 'B',
  role: 'coder' as const
}

it('lets a teammate join the next workspace after the owner stopped sharing (D-alief-12)', async () => {
  render(
    <JoinWithCodeCard
      connection={{
        server: 'https://collab.example.dev/',
        workspace: 'old',
        member: 'B',
        role: 'coder'
      }}
      onConnectionChange={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Join with a different code' }))
  expect(screen.getByRole('form', { name: 'Join with a code' })).toBeTruthy()
})

it('titles the joined workspace with your name and role, not the server member letter', async () => {
  status.state = 'syncing'
  status.message = null
  const state = {
    workspace: { id: 'w', name: 'old', headCommit: null, repoUrl: null },
    members: {
      B: { id: 'B', name: 'Budi', role: 'coder', color: null, online: true, stale: false, activeTaskId: null, blocked: false, writingUntil: 0 }
    },
    tasks: {}, locks: {}, files: {}, requests: {}, proposals: {}, feed: [], bobActivity: {}, cursor: 0
  } satisfies RadarState
  useRadarStore.setState({ state })
  render(<JoinWithCodeCard connection={member} onConnectionChange={vi.fn()} />)
  expect(await screen.findByRole('heading', { name: 'old · Budi (coder)' })).toBeTruthy()
  useRadarStore.setState({ state: null })
})

it('tells a PM why their edit was not sent', async () => {
  status.state = 'syncing'
  status.message = null
  status.rejected = 'A PM does not write files. Your change is kept in notes.md.radar-rejected.'
  render(<JoinWithCodeCard connection={{ ...member, role: 'pm' }} onConnectionChange={vi.fn()} />)
  expect(await screen.findByText(/A PM does not write files/)).toBeTruthy()
  status.rejected = null
})

it('names the files whose local copy was kept as .radar-conflict (D-alief-14)', async () => {
  status.conflicts = ['notes/a.md', 'b.md']
  render(<JoinWithCodeCard connection={member} onConnectionChange={vi.fn()} />)
  expect(
    (await screen.findByText(/2 files differed from the server/)).textContent
  ).toContain('notes/a.md, b.md')
})

it('after the owner stops sharing, says so calmly and offers the join form (D-alief-15)', async () => {
  status.state = 'stopped'
  status.message = '\u0007The owner stopped sharing this workspace.'
  status.stopReason = 'workspace-closed'
  render(<JoinWithCodeCard connection={member} onConnectionChange={vi.fn()} />)
  const form = await screen.findByRole('form', { name: 'Join with a code' })
  expect(form.textContent).toContain(
    'The owner stopped sharing. Your files stay in /Users/me/live-collab/old. Join with a new code.'
  )
  expect(form.textContent).not.toContain('\u0007')
  expect(form.textContent).not.toContain('Joined')
  expect(screen.queryByText(/Access rejected/)).toBeNull()
})

it('shows the joined view for a PM too', async () => {
  status.state = 'syncing'
  status.message = null
  render(<JoinWithCodeCard connection={{ ...member, role: 'pm' }} onConnectionChange={vi.fn()} />)
  expect(await screen.findByRole('region', { name: 'Your workspace' })).toBeTruthy()
})

it('Join with a different code can be cancelled', async () => {
  status.state = 'syncing'
  render(<JoinWithCodeCard connection={member} onConnectionChange={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Join with a different code' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('region', { name: 'Your workspace' })).toBeTruthy()
})

it('a first join has no Cancel', () => {
  render(<JoinWithCodeCard connection={null} onConnectionChange={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
})

it('fills in the name this person used before, so teammates see one name', async () => {
  render(<JoinWithCodeCard connection={null} onConnectionChange={vi.fn()} />)
  await vi.waitFor(() => {
    expect(screen.getByLabelText<HTMLInputElement>('Your name').value).toBe('Alief')
  })
})
