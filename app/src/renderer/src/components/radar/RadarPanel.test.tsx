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
    B: { id: 'B', name: 'Budi', role: 'coder', color: null, online: true, stale: false, activeTaskId: null, blocked: false, writingUntil: 0 }
  },
  tasks: {}, locks: {}, files: {}, requests: {}, proposals: {}, feed: [],
  bobActivity: { B: [{ id: 1, ts: 1000, memberId: 'B', kind: 'prompt', sessionId: 's', mode: 'coder', text: 'add dark mode' }] },
  cursor: 1
} satisfies RadarState

function Harness({ initial }: { initial: RadarPanelTab }) {
  const [tab, setTab] = useState<RadarPanelTab>(initial)
  return <RadarPanel tab={tab} connection={null} onConnectionChange={vi.fn()} onTabChange={setTab} />
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
    expect(screen.getByRole('button', { name: 'Watch Bob' }).getAttribute('aria-current')).toBe('page')

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

describe('Live Collab connection labels', () => {
  it('does not present cached members as online after disconnect', () => {
    useRadarStore.setState({ state, connected: false })
    render(<><RadarStatusItem /><Harness initial="team" /></>)

    expect(screen.getByLabelText('Live Collab status').textContent).toContain('offline')
    expect(screen.queryByText('1 online')).toBeNull()
    expect(screen.queryByRole('button', { name: "Watch Budi's Bob" })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeTruthy()
  })
})
