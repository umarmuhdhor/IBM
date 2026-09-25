import { describe, expect, it } from 'vitest'
import { getRadarViewModel } from './radar-view-model'
import type { RadarState } from '@radar/ui'

const state = {
  workspace: { id: 'w', name: 'Demo', headCommit: null, repoUrl: null },
  members: {
    A: { id: 'A', name: 'Andi', role: 'coder', online: true, activeTaskId: 'T-1', blocked: false },
    B: { id: 'B', name: 'Budi', role: 'coder', online: false, activeTaskId: null, blocked: true }
  },
  tasks: {
    'T-1': { id: 'T-1', title: 'Checkout', ownerId: 'A', status: 'dikerjakan', files: [], queuedFiles: [], editCount: 3, commitSha: null }
  },
  locks: {}, files: {}, requests: {},
  proposals: { p1: { id: 'p1', kind: 'decision', status: 'menunggu', payload: { title: 'Budi needs checkout.ts' }, reason: 'Shared file', refId: null, createdAt: 1 } },
  feed: [], bobActivity: {}, cursor: 1
} satisfies RadarState

describe('radar view model', () => {
  it('counts pending decisions and derives presence from the latest state', () => {
    const model = getRadarViewModel(state)
    expect(model.needsYou).toBe(1)
    expect(model.online).toBe(1)
    expect(model.tasks.working[0]?.id).toBe('T-1')
    expect(model.pending[0]?.id).toBe('p1')
  })
})
