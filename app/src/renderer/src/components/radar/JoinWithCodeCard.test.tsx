// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RadarSyncStatus } from '../../../../shared/radar-join'
import { JoinWithCodeCard } from './JoinWithCodeCard'

const status: RadarSyncStatus = {
  state: 'error',
  folder: '/Users/me/live-collab/old',
  files: null,
  message: 'Workspace reset',
  conflicts: []
}

beforeEach(() => {
  vi.stubGlobal('api', {
    radar: {
      getSyncStatus: vi.fn(async () => status),
      onSyncStatus: vi.fn(() => () => undefined),
      joinWithCode: vi.fn(),
      openInBob: vi.fn(),
      showFolder: vi.fn()
    }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  status.conflicts = []
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

it('names the files whose local copy was kept as .radar-conflict (D-alief-14)', async () => {
  status.conflicts = ['notes/a.md', 'b.md']
  render(<JoinWithCodeCard connection={member} onConnectionChange={vi.fn()} />)
  expect(
    (await screen.findByText(/2 files differed from the server/)).textContent
  ).toContain('notes/a.md, b.md')
})
