import { beforeEach, describe, expect, it } from 'vitest'
import { StateRes } from '@radar/common'
import { useRadarStore } from './radar-store'

const emptyState = StateRes.parse({
  workspace: { id: 'demo', name: 'demo', headCommit: null, repoUrl: null },
  members: [],
  tasks: [],
  locks: [],
  allocations: [],
  files: [],
  requests: [],
  proposals: [],
  recentEvents: [],
  cursor: 0
})

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
          queuedFiles: [],
          adhoc: false
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
        payload: { path: 'src/checkout.ts', taskId: 'T-1', memberId: 'A', auto: false }
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

  it('tracks access rejection until a connection succeeds', () => {
    const { receive } = useRadarStore.getState().actions
    receive({ kind: 'status', connected: false, failure: 'access-rejected' })
    expect(useRadarStore.getState().connectionFailure).toBe('access-rejected')
    receive({ kind: 'status', connected: true })
    expect(useRadarStore.getState().connectionFailure).toBeNull()
  })

  it('accepts array collections from the state endpoint', () => {
    useRadarStore.getState().actions.receive({
      kind: 'state',
      data: {
        ...emptyState,
        tasks: [{ id: 'T-2', title: 'Review', ownerId: 'B', status: 'review', files: [], editCount: 0 }],
        locks: [{ path: 'src/routes.ts', taskId: 'T-2', memberId: 'B', state: 'review', queue: [] }]
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

  it('rebuilds the feed and applies live events from the shared server contract', () => {
    const snapshot = StateRes.parse({
      workspace: { id: 'demo', name: 'Demo', headCommit: null, repoUrl: null },
      members: [{
        id: 'A', name: 'Aarief', role: 'coder', color: null, online: false,
        stale: false, activeTaskId: null, blocked: false, writingUntil: 0
      }],
      tasks: [], locks: [], allocations: [], files: [], requests: [], proposals: [],
      recentEvents: [{
        id: 1, ts: 100, actor: 'server', type: 'member.created',
        payload: { memberId: 'A', name: 'Aarief', role: 'coder' }
      }],
      cursor: 1
    })
    const { receive } = useRadarStore.getState().actions
    receive({ kind: 'state', data: snapshot })
    expect(useRadarStore.getState().state?.feed[0]?.type).toBe('member.created')

    receive({ kind: 'event', data: {
      id: 2, ts: 110, actor: 'server', type: 'member.online', payload: { memberId: 'A' }
    }, latencyMs: 12 })
    expect(useRadarStore.getState().state?.members.A?.online).toBe(true)
    expect(useRadarStore.getState().state?.feed[0]?.type).toBe('member.online')
  })
})
