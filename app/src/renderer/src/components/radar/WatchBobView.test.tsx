// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RadarState } from '@radar/ui'
import { WatchBobView } from './WatchBobView'

afterEach(cleanup)

const budi = {
  id: 'B', name: 'Budi', role: 'coder' as const, color: null, online: true, stale: false,
  activeTaskId: 'T-2', blocked: true, writingUntil: 0
}

const state = {
  workspace: { id: 'w', name: 'Demo', headCommit: null, repoUrl: null },
  members: { B: budi }, tasks: {}, locks: {}, files: {}, requests: {}, proposals: {},
  feed: [{ id: 4, ts: 4000, actor: 'B', type: 'task.submitted', text: '10:20 B submit T-2' }],
  bobActivity: {
    B: [
      { id: 3, ts: 3000, memberId: 'B', kind: 'tool.pre', sessionId: 's', mode: 'coder', tool: 'apply_diff', paths: ['src/checkout/checkout.ts'], decision: 'block' },
      { id: 2, ts: 2000, memberId: 'B', kind: 'tool.post', sessionId: 's', mode: 'coder', tool: 'write_file', paths: ['src/ui/Header.tsx'], linesChanged: 8 },
      { id: 1, ts: 1000, memberId: 'B', kind: 'prompt', sessionId: 's', mode: 'coder' }
    ]
  },
  cursor: 4
} satisfies RadarState

describe('WatchBobView', () => {
  it('shows the watched member’s Bob timeline in the owner color', () => {
    render(<WatchBobView state={state} memberId="B" onStopWatching={vi.fn()} />)

    const view = screen.getByRole('region', { name: "Watching Budi's Bob · coder" })
    expect(view.getAttribute('data-member')).toBe('B')
    const rows = within(screen.getByRole('list', { name: 'Bob activity' })).getAllByRole('listitem')
    expect(rows.map((row) => row.getAttribute('data-kind'))).toEqual(['prompt', 'write', 'blocked', 'submit'])
    expect(within(rows[1]).getByText('src/ui/Header.tsx')).toBeTruthy()
    expect(within(rows[1]).getByText('8 lines')).toBeTruthy()
    expect(within(rows[2]).getByLabelText('Bob trace: hook PreToolUse · lock_guard → blocked')).toBeTruthy()
    expect(within(rows[0]).getByText('Prompt text not shared')).toBeTruthy()
  })

  it('points forward when the member has no Bob activity yet', () => {
    render(<WatchBobView state={{ ...state, feed: [], bobActivity: {} }} memberId="B" onStopWatching={vi.fn()} />)
    expect(screen.getByText(/Budi's prompts, reads, writes and blocks appear here/)).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Bob activity' })).toBeNull()
  })

  it('returns to the team when the member left the workspace', () => {
    const onStopWatching = vi.fn()
    render(<WatchBobView state={state} memberId="Z" onStopWatching={onStopWatching} />)
    expect(screen.getByText('This teammate is not in the workspace any more.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Team' }))
    expect(onStopWatching).toHaveBeenCalled()
  })

  it('stops watching from the header', () => {
    const onStopWatching = vi.fn()
    render(<WatchBobView state={state} memberId="B" onStopWatching={onStopWatching} />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop watching' }))
    expect(onStopWatching).toHaveBeenCalled()
  })
})
