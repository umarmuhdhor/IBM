import { beforeEach, describe, expect, it } from 'vitest'
import { useRadarStore } from './radar-store'

const emptyState = {
  workspace: { id: 'demo', name: 'demo', headCommit: null, repoUrl: null },
  members: {},
  tasks: {},
  locks: {},
  files: {},
  requests: {},
  proposals: {},
  feed: [],
  bobActivity: {},
  cursor: 0
}

describe('Radar renderer store', () => {
  beforeEach(() => useRadarStore.getState().actions.clear())

  it('applies a task and lock event sequence after a snapshot', () => {
    const { receive } = useRadarStore.getState().actions
    receive({ kind: 'state', data: emptyState })
    receive({
      kind: 'event',
      data: {
        id: 1,
        ts: 100,
        actor: 'server',
        type: 'task.created',
        payload: {
          taskId: 'T-1',
          title: 'Checkout',
          ownerId: 'A',
          status: 'dikerjakan',
          files: ['src/checkout.ts'],
          queuedFiles: []
        }
      },
      latencyMs: 31
    })
    receive({
      kind: 'event',
      data: {
        id: 2,
        ts: 110,
        actor: 'server',
        type: 'lock.acquired',
        payload: { path: 'src/checkout.ts', taskId: 'T-1', memberId: 'A' }
      },
      latencyMs: 28
    })

    expect(useRadarStore.getState().state?.tasks['T-1']?.status).toBe('dikerjakan')
    expect(useRadarStore.getState().state?.locks['src/checkout.ts']?.state).toBe('dipegang')
    expect(useRadarStore.getState().state?.cursor).toBe(2)
    expect(useRadarStore.getState().latencyMs).toBe(28)
  })

  it('keeps the last snapshot when the server disconnects', () => {
    const { receive } = useRadarStore.getState().actions
    receive({ kind: 'state', data: emptyState })
    receive({ kind: 'status', connected: false })
    expect(useRadarStore.getState().state?.workspace.id).toBe('demo')
    expect(useRadarStore.getState().connected).toBe(false)
  })

  it('accepts array collections from the state endpoint', () => {
    useRadarStore.getState().actions.receive({
      kind: 'state',
      data: {
        ...emptyState,
        tasks: [{ id: 'T-2', title: 'Review', ownerId: 'B', status: 'review' }],
        locks: [{ path: 'src/routes.ts', taskId: 'T-2', memberId: 'B', state: 'review' }]
      }
    })
    expect(useRadarStore.getState().state?.tasks['T-2']?.title).toBe('Review')
    expect(useRadarStore.getState().state?.locks['src/routes.ts']?.state).toBe('review')
  })

  it('changes a pending proposal only after the server decision event', () => {
    const { receive } = useRadarStore.getState().actions
    receive({ kind: 'state', data: emptyState })
    receive({
      kind: 'event',
      data: {
        id: 1,
        ts: 100,
        actor: 'server',
        type: 'proposal.created',
        payload: {
          proposalId: 'P-5',
          kind: 'decision',
          refId: 'R-3',
          reason: 'Access needed',
          payload: { requestId: 'R-3', option: 'antre' }
        }
      },
      latencyMs: 20
    })
    expect(useRadarStore.getState().state?.proposals['P-5']?.status).toBe('menunggu')
    receive({
      kind: 'event',
      data: {
        id: 2,
        ts: 110,
        actor: 'mc',
        type: 'proposal.decided',
        payload: { proposalId: 'P-5', kind: 'decision', status: 'disetujui', by: 'mc' }
      },
      latencyMs: 15
    })
    expect(useRadarStore.getState().state?.proposals['P-5']?.status).toBe('disetujui')
  })
})
