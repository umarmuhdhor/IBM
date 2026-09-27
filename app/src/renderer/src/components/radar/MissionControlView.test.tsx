// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RadarState } from '@radar/ui'
import { MissionControlView } from './MissionControlView'

afterEach(cleanup)

const state = {
  workspace: { id: 'w', name: 'Demo', headCommit: null, repoUrl: null },
  members: {}, tasks: {}, locks: {}, files: {}, requests: {},
  proposals: { p1: { id: 'p1', kind: 'decision', status: 'menunggu', payload: { title: 'Blocked edit' }, reason: 'File held', refId: null, createdAt: 1, decidedBy: null, note: null } },
  feed: [], bobActivity: {}, cursor: 0
} satisfies RadarState

describe('MissionControlView', () => {
  it('keeps coder decisions read-only', () => {
    render(<MissionControlView state={state} canDecide={false} now={0} />)
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.getByText('Only Mission Control can decide.')).toBeTruthy()
  })

  it('waits for a server decision event after the PM approves', () => {
    const decide = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'api', { configurable: true, value: { radar: { decide } } })
    render(<MissionControlView state={state} canDecide now={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(decide).toHaveBeenCalledWith('p1', true, '')
    expect(screen.getByRole('button', { name: 'Approve' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows the shared feed sentence without repeating its clock prefix', () => {
    render(<MissionControlView state={{
      ...state,
      feed: [{ id: 2, ts: 1, actor: 'B', type: 'file.changed', text: '10:19 Bob B ubah Header.tsx' }]
    }} canDecide={false} now={0} />)
    expect(screen.getByText('Bob B ubah Header.tsx')).toBeTruthy()
  })

  it('titles a review by its task and never shows a diff size the proposal did not report', () => {
    render(<MissionControlView state={{
      ...state,
      proposals: { p2: { id: 'P-2', kind: 'review', status: 'menunggu', payload: {}, reason: 'Looks right', refId: 'T-0', createdAt: 1, decidedBy: null, note: null } }
    }} canDecide now={0} />)
    expect(screen.getByText('Review · T-0')).toBeTruthy()
    expect(screen.queryByText(/\+0 −0/)).toBeNull()
  })

  it('lists claimed files with holder and queue under Shared repo', () => {
    const member = { role: 'coder' as const, color: null, online: true, stale: false, activeTaskId: null, blocked: false, writingUntil: 0 }
    const task = { description: '', queuedFiles: [], adhoc: false, parentTaskId: null, editCount: 0, commitSha: null, summary: null, steps: [], status: 'dikerjakan' as const }
    render(<MissionControlView now={0} canDecide={false} state={{
      ...state,
      members: { A: { ...member, id: 'A', name: 'Andi' }, B: { ...member, id: 'B', name: 'Budi' } },
      tasks: { 'T-1': { ...task, id: 'T-1', title: 'Kupon', ownerId: 'A', files: [] }, 'T-2': { ...task, id: 'T-2', title: 'Dark mode', ownerId: 'B', files: [] } },
      locks: { 'src/checkout.ts': { path: 'src/checkout.ts', taskId: 'T-1', memberId: 'A', state: 'dipegang', queue: ['T-2'] } }
    }} />)
    const repo = screen.getByRole('region', { name: 'Shared repo' })
    expect(repo.textContent).toContain('Andi · held')
    expect(repo.textContent).toContain('Budi queued #1')
  })
})
