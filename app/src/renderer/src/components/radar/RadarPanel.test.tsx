// @vitest-environment happy-dom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RadarState } from '@radar/ui'
import { useRadarStore } from '@/store/radar-store'
import type { RadarPanelTab } from './radar-panel-tab'

vi.mock('@/store', () => ({
  useAppStore: (select: (store: unknown) => unknown) =>
    select({ activeWorktreeId: null, getKnownWorktreeById: () => null })
}))
vi.mock('@/components/sidebar/WorktreeOpenInMenu', () => ({ openWorktreePath: vi.fn() }))

const { RadarPanel } = await import('./RadarPanel')
const { RadarStatusItem } = await import('./RadarStatusItem')

const state = {
  workspace: { id: 'w', name: 'Demo', headCommit: null, repoUrl: null },
  members: {
    B: {
      id: 'B',
      name: 'Budi',
      role: 'coder',
      color: null,
      online: true,
      stale: false,
      activeTaskId: null,
      blocked: false,
      writingUntil: 0
    }
  },
  tasks: {},
  locks: {},
  files: {},
  requests: {},
  proposals: {},
  feed: [],
  bobActivity: {
    B: [
      {
        id: 1,
        ts: 1000,
        memberId: 'B',
        kind: 'prompt',
        sessionId: 's',
        mode: 'coder',
        text: 'add dark mode'
      }
    ]
  },
  cursor: 1
} satisfies RadarState

const connection = {
  server: 'https://collab.example.dev/',
  workspace: 'w',
  member: 'B',
  role: 'coder'
} as const

function Harness({
  initial,
  joined = true,
  role = 'coder'
}: {
  initial: RadarPanelTab
  joined?: boolean
  role?: 'coder' | 'mc'
}) {
  const [tab, setTab] = useState<RadarPanelTab>(initial)
  return (
    <RadarPanel
      tab={tab}
      connection={joined ? { ...connection, role, member: role === 'mc' ? 'mc' : 'B' } : null}
      onConnectionChange={vi.fn()}
      onTabChange={setTab}
    />
  )
}

beforeEach(() => {
  useRadarStore.setState({ state, connected: true, now: 2000 })
})

afterEach(() => {
  cleanup()
  useRadarStore.setState({ state: null, connected: false })
})

describe('RadarPanel watch tab', () => {
  it('opens Watch Bob for the member picked in Team and returns on stop', () => {
    render(<Harness initial="team" />)

    fireEvent.click(screen.getByRole('button', { name: "Watch Budi's Bob" }))
    expect(screen.getByRole('region', { name: "Watching Budi's Bob · coder" })).toBeTruthy()
    expect(screen.getByText('“add dark mode”')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Watch Bob' }).getAttribute('aria-current')).toBe(
      'page'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Stop watching' }))
    expect(screen.getByRole('region', { name: 'Team' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Watch Bob' })).toBeNull()
  })

  it('asks for a teammate when the watch tab opens without one', () => {
    render(<Harness initial="watch" />)
    expect(screen.getByText('Pick a teammate in Team to watch their Bob.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Team' }))
    expect(screen.getByRole('region', { name: 'Team' })).toBeTruthy()
  })
})

describe('RadarPanel without a connection', () => {
  it('offers the join code form instead of the team views', () => {
    const stopListening = vi.fn()
    vi.stubGlobal('api', {
      radar: {
        getSyncStatus: vi.fn(async () => ({
          state: 'stopped',
          folder: null,
          files: null,
          message: null,
          conflicts: [],
          stopReason: null
        })),
        onSyncStatus: vi.fn(() => stopListening),
        getProfileName: vi.fn(async () => null)
      }
    })
    render(<Harness initial="team" joined={false} />)
    expect(screen.getByRole('form', { name: 'Join with a code' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Team' })).toBeNull()
    vi.unstubAllGlobals()
  })
})

describe('Team seats (D-alief-20)', () => {
  it('only Mission Control sees Remove on a teammate card', () => {
    const { unmount } = render(<Harness initial="team" />)
    expect(screen.queryByRole('button', { name: 'Remove Budi' })).toBeNull()
    unmount()
    vi.stubGlobal('api', { radar: { mySeat: vi.fn(async () => null) } })
    render(<Harness initial="team" role="mc" />)
    expect(screen.getByRole('button', { name: 'Remove Budi' })).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('tells a removed member why the team views are gone', () => {
    useRadarStore.setState({ state, connected: false, connectionFailure: 'removed' })
    render(<Harness initial="team" />)
    expect(
      screen.getByText('The owner removed you from this workspace. Join with a new code in Multiplayer.')
    ).toBeTruthy()
    useRadarStore.setState({ connectionFailure: null })
  })
})

describe('Live Collab connection labels', () => {
  it('does not present cached members as online after disconnect', () => {
    useRadarStore.setState({ state, connected: false })
    render(
      <>
        <RadarStatusItem />
        <Harness initial="team" />
      </>
    )

    expect(screen.getByLabelText('Live Collab status').textContent).toContain('offline')
    expect(screen.queryByText('1 online')).toBeNull()
    expect(screen.queryByRole('button', { name: "Watch Budi's Bob" })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open Multiplayer' })).toBeTruthy()
  })
})

describe('Multiplayer and Settings tabs', () => {
  it('Multiplayer is its own tab with its own title, next to Settings', () => {
    vi.stubGlobal('api', {
      radar: {
        getSyncStatus: vi.fn(async () => ({
          state: 'stopped',
          folder: null,
          files: null,
          message: null,
          conflicts: [],
          stopReason: null
        })),
        onSyncStatus: vi.fn(() => () => undefined),
        getProfileName: vi.fn(async () => null),
        runChecks: vi.fn(async () => ({ bobVersion: null, bobSettings: null })),
        getSharePrompts: vi.fn(async () => false)
      }
    })
    render(<Harness initial="multiplayer" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Multiplayer')
    expect(screen.getByRole('form', { name: 'Join with a code' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Settings')
    expect(screen.queryByRole('form', { name: 'Join with a code' })).toBeNull()
    vi.unstubAllGlobals()
  })
})

describe('Invite teammates after a folder switch', () => {
  it('forgets codes made for the workspace this app no longer shares', async () => {
    vi.stubGlobal('api', {
      radar: {
        getSyncStatus: vi.fn(async () => ({
          state: 'stopped',
          folder: null,
          files: null,
          message: null,
          conflicts: [],
          stopReason: null
        })),
        onSyncStatus: vi.fn(() => () => undefined),
        getProfileName: vi.fn(async () => null),
        createJoinCode: vi.fn(async () => ({ member: null, code: 'WMAW-K7TN', expiresAt: 1 })),
        copyText: vi.fn(async () => undefined),
        mySeat: vi.fn(async () => null)
      }
    })
    const owner = { ...connection, member: 'mc', role: 'mc' } as const
    const props = { tab: 'multiplayer', onConnectionChange: vi.fn(), onTabChange: vi.fn() } as const
    const { rerender } = render(<RadarPanel connection={owner} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Make code' }))
    expect(await screen.findByText('WMAW-K7TN')).toBeTruthy()
    rerender(<RadarPanel connection={{ ...owner, workspace: 'gamma' }} {...props} />)
    expect(screen.queryByText('WMAW-K7TN')).toBeNull()
    expect(screen.queryByText(/Copied WMAW-K7TN/)).toBeNull()
    vi.unstubAllGlobals()
  })
})
