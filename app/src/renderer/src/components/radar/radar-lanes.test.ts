import { describe, expect, it } from 'vitest'
import type { RadarState } from '@radar/ui'
import { lastPrompt, queueSpots, recentActivity, repoRows } from './radar-lanes'

const member = { role: 'coder' as const, color: null, online: true, stale: false, activeTaskId: null, blocked: false, writingUntil: 0 }
const task = { description: '', queuedFiles: [], adhoc: false, parentTaskId: null, editCount: 0, commitSha: null, summary: null, steps: [] }

const state = {
  workspace: { id: 'w', name: 'toko-demo', headCommit: null, repoUrl: null },
  members: { A: { ...member, id: 'A', name: 'Andi' }, B: { ...member, id: 'B', name: 'Budi' } },
  tasks: {
    'T-1': { ...task, id: 'T-1', title: 'Kupon', ownerId: 'A', status: 'dikerjakan' as const, files: ['src/checkout/checkout.ts'] },
    'T-2': { ...task, id: 'T-2', title: 'Dark mode', ownerId: 'B', status: 'dikerjakan' as const, files: ['src/ui/theme.css'] }
  },
  locks: {
    'src/checkout/checkout.ts': { path: 'src/checkout/checkout.ts', taskId: 'T-1', memberId: 'A', state: 'dipegang' as const, queue: ['T-2'] },
    'src/ui/theme.css': { path: 'src/ui/theme.css', taskId: 'T-2', memberId: 'B', state: 'dipesan' as const, queue: [] }
  },
  files: {
    'src/ui/theme.css': { path: 'src/ui/theme.css', version: 1, updatedBy: 'B', updatedAt: 1, writingUntil: 5_000, deleted: false },
    'README.md': { path: 'README.md', version: 1, updatedBy: null, updatedAt: 1, writingUntil: 0, deleted: false }
  },
  requests: {}, proposals: {}, feed: [],
  bobActivity: {
    B: [
      { id: 9, ts: 9, memberId: 'B', kind: 'tool.pre' as const, sessionId: 's', mode: 'coder', tool: 'apply_diff', paths: ['src/checkout/checkout.ts'], decision: 'block' as const },
      { id: 8, ts: 8, memberId: 'B', kind: 'tool.post' as const, sessionId: 's', mode: 'coder', tool: 'write_file', paths: ['src/ui/theme.css'], linesChanged: 22 },
      { id: 7, ts: 7, memberId: 'B', kind: 'prompt' as const, sessionId: 's', mode: 'coder', text: 'tambahkan toggle dark mode di header' },
      { id: 6, ts: 6, memberId: 'B', kind: 'session.start' as const, sessionId: 's', mode: 'coder' }
    ]
  },
  cursor: 9
} satisfies RadarState

describe('radar lanes', () => {
  it('lists every file with holder, lock word, writing badge and queue', () => {
    expect(repoRows(state, 3_000)).toEqual([
      { path: 'README.md', holderId: null, holderName: null, holderLabel: null, lock: null, writing: false, queue: [] },
      { path: 'src/checkout/checkout.ts', holderId: 'A', holderName: 'Andi', holderLabel: 'Andi', lock: 'held', writing: false, queue: [{ memberId: 'B', name: 'Budi', pos: 1 }] },
      { path: 'src/ui/theme.css', holderId: 'B', holderName: 'Budi', holderLabel: 'Budi', lock: 'reserved', writing: true, queue: [] }
    ])
    expect(repoRows(state, 9_000)[2]?.writing).toBe(false)
  })

  it('tells a queued member where they stand', () => {
    expect(queueSpots(state, 'B')).toEqual([{ path: 'src/checkout/checkout.ts', pos: 1, holderName: 'Andi', holds: 'it' }])
    expect(queueSpots(state, 'A')).toEqual([])
  })

  it('names the locked lines of a line-range lock (D-alief-17)', () => {
    const ranged = {
      ...state,
      locks: { ...state.locks, 'src/checkout/checkout.ts': { ...state.locks['src/checkout/checkout.ts'], range: { start: 3, end: 5 } } }
    } satisfies RadarState
    expect(repoRows(ranged, 3_000)[1]).toMatchObject({ holderName: 'Andi', holderLabel: 'lines 3–5 · Andi', lock: 'held' })
    expect(queueSpots(ranged, 'B')).toEqual([{ path: 'src/checkout/checkout.ts', pos: 1, holderName: 'Andi', holds: 'lines 3–5' }])
  })

  it('quotes the last shared prompt and turns Bob activity into hook and mode rows', () => {
    expect(lastPrompt(state, 'B')).toBe('tambahkan toggle dark mode di header')
    expect(lastPrompt(state, 'A')).toBeNull()
    expect(recentActivity(state, 'B')).toEqual([
      { id: 9, primitive: 'hook', detail: 'apply_diff checkout.ts', outcome: { text: 'blocked', tone: 'block' } },
      { id: 8, primitive: 'hook', detail: 'write_file theme.css', outcome: { text: '+22 lines', tone: 'ok' } },
      { id: 7, primitive: 'hook', detail: 'prompt from the human', outcome: null },
      { id: 6, primitive: 'mode', detail: 'session start · coder', outcome: null }
    ])
  })
})
