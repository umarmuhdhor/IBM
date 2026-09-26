// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RadarState } from '@radar/ui'

vi.mock('@/store', () => ({
  useAppStore: (select: (store: unknown) => unknown) =>
    select({ activeWorktreeId: null, getKnownWorktreeById: () => null })
}))
vi.mock('@/components/sidebar/WorktreeOpenInMenu', () => ({ openWorktreePath: vi.fn() }))

const { TeamPanel } = await import('./TeamPanel')

afterEach(cleanup)

const base = { role: 'coder' as const, color: null, stale: false, activeTaskId: null, blocked: false, writingUntil: 0 }

const state = {
  workspace: { id: 'w', name: 'Demo', headCommit: null, repoUrl: null },
  members: {
    A: { ...base, id: 'A', name: 'Andi', online: true, activeTaskId: 'T-1', writingUntil: 5_000 },
    B: { ...base, id: 'B', name: 'Budi', online: true, blocked: true },
    C: { ...base, id: 'C', name: 'Citra', online: false, role: 'pm' as const }
  },
  tasks: {}, locks: {}, files: {}, requests: {}, proposals: {}, feed: [],
  bobActivity: {
    A: [{ id: 2, ts: 2000, memberId: 'A', kind: 'tool.post', sessionId: 's', mode: 'coder', tool: 'write_file', paths: ['a.ts'] }],
    B: [{ id: 1, ts: 1000, memberId: 'B', kind: 'tool.pre', sessionId: 's', mode: 'coder', tool: 'apply_diff', paths: ['a.ts'], decision: 'block' }]
  },
  cursor: 2
} satisfies RadarState

function card(name: string): HTMLElement {
  return screen.getByRole('article', { name })
}

describe('TeamPanel', () => {
  it('offers Watch only for online members and reports who was picked', () => {
    const onWatch = vi.fn()
    render(<TeamPanel state={state} now={3_000} onWatch={onWatch} />)

    expect(within(card('Citra')).queryByRole('button', { name: /Watch/ })).toBeNull()
    fireEvent.click(within(card('Budi')).getByRole('button', { name: "Watch Budi's Bob" }))
    expect(onWatch).toHaveBeenCalledWith('B')
  })

  it('shows writing and blocked from the Bob activity events', () => {
    render(<TeamPanel state={state} now={3_000} onWatch={vi.fn()} />)

    expect(within(card('Andi')).getByText('writing ✎')).toBeTruthy()
    expect(within(card('Budi')).getByText('blocked')).toBeTruthy()
    expect(within(card('Andi')).getByLabelText('Agent Andi · Bob coder, member A').getAttribute('data-status')).toBe('writing')
  })

  it('drops the writing indicator once the window passes', () => {
    render(<TeamPanel state={state} now={9_000} onWatch={vi.fn()} />)
    expect(within(card('Andi')).queryByText('writing ✎')).toBeNull()
    expect(within(card('Andi')).getByLabelText('Agent Andi · Bob coder, member A').getAttribute('data-status')).toBe('idle')
  })
})
