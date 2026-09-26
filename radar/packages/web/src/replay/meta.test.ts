import { describe, expect, it } from 'vitest';
import type { RadarEvent } from '@radar/common';
import { buildReplayMeta } from './meta.js';

function ev(id: number, ts: number, type: string, payload: unknown = {}): RadarEvent {
  return { id, ts, actor: 'server', type, payload } as unknown as RadarEvent;
}

describe('buildReplayMeta', () => {
  it('bundles workspace, chapters, metrics and links', () => {
    const events = [
      ev(1, 0, 'workspace.created', { workspaceId: 'toko-demo', headCommit: 'a1b2c3d', fileCount: 3 }),
      ev(2, 1_000, 'proposal.created', { kind: 'plan' }),
      ev(3, 2_000, 'file.changed', { path: 'a.ts' }),
      ev(
        4,
        3_000,
        'lock.blocked',
        { path: 'a.ts', memberId: 'B', taskId: 'T-2', holderMemberId: 'A', holderTaskId: 'T-1', via: 'hook', requestId: 'R-1' },
      ),
    ];
    const links = {
      repoUrl: 'https://github.com/umarmuhdhor/IBM',
      bobSessions: 'https://github.com/umarmuhdhor/IBM/tree/main/bob_sessions',
      video: null,
      deck: null,
    };
    const meta = buildReplayMeta('toko-demo', 99_999, events, links);
    expect(meta.workspace).toBe('toko-demo');
    expect(meta.exportedAt).toBe(99_999);
    expect(meta.chapters.map((c) => c.id)).toEqual(['plan', 'live', 'near-miss']);
    expect(meta.metrics.nearMisses).toBe(1);
    expect(meta.links).toEqual(links);
  });
});
