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
    // Once in the status line, once as the blocked hook row under Bob activity.
    expect(within(card('Budi')).getAllByText('blocked')).toHaveLength(2)
    expect(within(card('Budi')).getByRole('list', { name: "Budi's Bob activity" }).textContent).toContain('apply_diff a.ts')
    expect(within(card('Andi')).getByLabelText('Agent Andi · Bob coder, member A').getAttribute('data-status')).toBe('writing')
  })

  it('drops the writing indicator once the window passes', () => {
    render(<TeamPanel state={state} now={9_000} onWatch={vi.fn()} />)
    expect(within(card('Andi')).queryByText('writing ✎')).toBeNull()
    expect(within(card('Andi')).getByLabelText('Agent Andi · Bob coder, member A').getAttribute('data-status')).toBe('idle')
  })

  it('lets Mission Control remove a seat after a confirmation, never the owner seat A (D-alief-20)', async () => {
    const removeMember = vi.fn(async () => undefined)
    vi.stubGlobal('window', Object.assign(window, { api: { radar: { removeMember } } }))
    render(<TeamPanel state={state} now={3_000} onWatch={vi.fn()} canRemove />)

    expect(within(card('Andi')).queryByRole('button', { name: /Remove/ })).toBeNull()
    fireEvent.click(within(card('Budi')).getByRole('button', { name: 'Remove Budi' }))
    expect(within(card('Budi')).getByRole('alertdialog', { name: 'Remove Budi?', description: 'Their open tasks are cancelled, and they need a new code to join again.' })).toBeTruthy()
    fireEvent.keyDown(within(card('Budi')).getByRole('alertdialog', { name: 'Remove Budi?' }), { key: 'Escape' })
    expect(within(card('Budi')).queryByRole('alertdialog', { name: 'Remove Budi?' })).toBeNull()
    expect(removeMember).not.toHaveBeenCalled()

    fireEvent.click(within(card('Budi')).getByRole('button', { name: 'Remove Budi' }))
    fireEvent.click(within(card('Budi')).getByRole('button', { name: 'Remove' }))
    expect(removeMember).toHaveBeenCalledWith('B')
    await vi.waitFor(() => expect(within(card('Budi')).queryByRole('alertdialog', { name: 'Remove Budi?' })).toBeNull())
  })

  it("shows the server's reason when a removal fails", async () => {
    const removeMember = vi.fn(async () => {
      throw new Error("Error invoking remote method 'radar:remove-member': Error: There is no member B.")
    })
    vi.stubGlobal('window', Object.assign(window, { api: { radar: { removeMember } } }))
    render(<TeamPanel state={state} now={3_000} onWatch={vi.fn()} canRemove />)
    fireEvent.click(within(card('Budi')).getByRole('button', { name: 'Remove Budi' }))
    fireEvent.click(within(card('Budi')).getByRole('button', { name: 'Remove' }))
    expect(await within(card('Budi')).findByRole('alert')).toHaveProperty('textContent', 'There is no member B.')
  })

  it('offers no Remove to teammates', () => {
    render(<TeamPanel state={state} now={3_000} onWatch={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull()
  })
})
