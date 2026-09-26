import { describe, expect, it } from 'vitest'
import type { BobActivityItem, RadarState } from '@radar/ui'
import { watchBobMode, watchBobTimeline } from './watch-bob-timeline'

const member = {
  id: 'B', name: 'Budi', role: 'coder' as const, color: null, online: true, stale: false,
  activeTaskId: 'T-2', blocked: false, writingUntil: 0
}

function activity(id: number, fields: Partial<BobActivityItem> & Pick<BobActivityItem, 'kind'>): BobActivityItem {
  return { id, ts: id * 1000, memberId: 'B', sessionId: 's1', mode: 'coder', ...fields }
}

function stateWith(bob: BobActivityItem[], feed: RadarState['feed'] = []): RadarState {
  return {
    workspace: { id: 'w', name: 'Demo', headCommit: null, repoUrl: null },
    members: { B: member }, tasks: {}, locks: {}, files: {}, requests: {}, proposals: {},
    // The reducer keeps both lists newest first.
    feed, bobActivity: { B: bob.toReversed() }, cursor: 0
  }
}

describe('watchBobTimeline', () => {
  it('orders Bob activity oldest first with kind labels, paths and traces', () => {
    const rows = watchBobTimeline(stateWith([
      activity(1, { kind: 'session.start' }),
      activity(2, { kind: 'prompt', text: 'add dark mode toggle' }),
      activity(3, { kind: 'tool.post', tool: 'read_file', paths: ['src/ui/theme.css'] }),
      activity(4, { kind: 'tool.pre', tool: 'apply_diff', paths: ['src/checkout/checkout.ts'], decision: 'block' }),
      activity(5, { kind: 'tool.post', tool: 'write_file', paths: ['src/ui/Header.tsx'], linesChanged: 8 }),
      activity(6, { kind: 'turn.end' })
    ]), 'B')

    expect(rows.map((row) => row.label)).toEqual(['session', 'prompt', 'read', 'blocked', 'write', 'turn end'])
    expect(rows[1]).toMatchObject({ detail: '“add dark mode toggle”', trace: { primitive: 'hook', detail: 'UserPromptSubmit' } })
    expect(rows[2]).toMatchObject({ detail: 'src/ui/theme.css', trace: { primitive: 'hook', detail: 'PostToolUse · read_file' } })
    expect(rows[3]).toMatchObject({
      kind: 'blocked', detail: 'src/checkout/checkout.ts',
      trace: { primitive: 'hook', detail: 'PreToolUse · lock_guard', outcome: 'blocked' }
    })
    expect(rows[4]).toMatchObject({ kind: 'write', detail: 'src/ui/Header.tsx', lines: 8 })
    expect(rows[0].trace).toEqual({ primitive: 'mode', detail: 'coder' })
  })

  it('hides allowed pre-tool checks because the post-tool row reports the same call', () => {
    const rows = watchBobTimeline(stateWith([
      activity(1, { kind: 'tool.pre', tool: 'write_file', paths: ['a.ts'], decision: 'allow' }),
      activity(2, { kind: 'tool.post', tool: 'write_file', paths: ['a.ts'] })
    ]), 'B')
    expect(rows.map((row) => row.kind)).toEqual(['write'])
  })

  it('says when a prompt was not shared instead of showing text', () => {
    const [row] = watchBobTimeline(stateWith([activity(1, { kind: 'prompt' })]), 'B')
    expect(row.detail).toBe('Prompt text not shared')
  })

  it('merges only this member’s edits, blocks and submits from the feed', () => {
    const rows = watchBobTimeline(stateWith(
      [activity(2, { kind: 'tool.post', tool: 'write_file', paths: ['src/ui/theme.css'] })],
      [
        { id: 9, ts: 9000, actor: 'B', type: 'task.submitted', text: '10:20 B submit T-2' },
        { id: 7, ts: 7000, actor: 'A', type: 'file.changed', text: '10:19 Bob A ubah checkout.ts' },
        { id: 5, ts: 5000, actor: 'B', type: 'lock.blocked', text: '10:19 Bob B diblokir di checkout.ts (milik A)' },
        { id: 4, ts: 4000, actor: 'B', type: 'member.online', text: '10:18 B terhubung' },
        { id: 3, ts: 3000, actor: 'B', type: 'file.changed', text: '10:18 Bob B ubah theme.css' }
      ]
    ), 'B')

    expect(rows.map((row) => [row.id, row.label])).toEqual([
      ['bob-2', 'write'], ['feed-3', 'edit'], ['feed-5', 'blocked'], ['feed-9', 'submit']
    ])
    expect(rows[2]).toMatchObject({ detail: 'Bob B diblokir di checkout.ts (milik A)', trace: null })
  })

  it('returns an empty timeline for a member without activity', () => {
    expect(watchBobTimeline(stateWith([]), 'Z')).toEqual([])
  })
})

describe('watchBobMode', () => {
  it('uses the latest reported Bob mode', () => {
    expect(watchBobMode(stateWith([activity(1, { kind: 'prompt', mode: 'coder' }), activity(2, { kind: 'turn.end', mode: 'pm-lead' })]), 'B')).toBe('pm-lead')
  })

  it('falls back to the member role before any activity arrives', () => {
    const state = stateWith([])
    expect(watchBobMode(state, 'B')).toBe('coder')
    expect(watchBobMode({ ...state, members: { B: { ...member, role: 'pm' } } }, 'B')).toBe('pm-lead')
  })
})
