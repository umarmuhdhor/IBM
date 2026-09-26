import { describe, expect, it } from 'vitest';
import type { RadarEvent } from '@radar/common';
import { buildChapters } from './chapters.js';

function ev(id: number, ts: number, type: string, payload: unknown = {}): RadarEvent {
  return { id, ts, actor: 'server', type, payload } as unknown as RadarEvent;
}

describe('buildChapters', () => {
  it('returns no chapters for an empty timeline', () => {
    expect(buildChapters([])).toEqual([]);
  });

  it('marks a chapter at the first event of each kind, in chronological order', () => {
    const events = [
      ev(1, 0, 'workspace.created'),
      ev(2, 1000, 'proposal.created', { kind: 'plan' }),
      ev(3, 2000, 'file.changed', { path: 'a.ts' }),
      ev(4, 3000, 'lock.blocked', { path: 'a.ts' }),
      ev(5, 4000, 'lock.review', { path: 'a.ts' }),
      ev(6, 5000, 'commit.created', { taskId: 'T-1' }),
    ];
    expect(buildChapters(events)).toEqual([
      { id: 'plan', label: 'Plan', ts: 1000 },
      { id: 'live', label: 'Live', ts: 2000 },
      { id: 'near-miss', label: 'Near-miss', ts: 3000 },
      { id: 'review', label: 'Review', ts: 4000 },
      { id: 'commit', label: 'Commit', ts: 5000 },
    ]);
  });

  it('ignores a proposal.created that is not a plan for the Plan chapter', () => {
    const events = [ev(1, 500, 'proposal.created', { kind: 'review' })];
    expect(buildChapters(events)).toEqual([]);
  });

  it('accepts review.created as an alternate Review marker when lock.review never happens', () => {
    const events = [ev(1, 900, 'review.created', { taskId: 'T-1', verdict: 'setujui' })];
    expect(buildChapters(events)).toEqual([{ id: 'review', label: 'Review', ts: 900 }]);
  });

  it('only takes the first occurrence of each kind', () => {
    const events = [
      ev(1, 1000, 'file.changed', { path: 'a.ts' }),
      ev(2, 5000, 'file.changed', { path: 'b.ts' }),
    ];
    expect(buildChapters(events)).toEqual([{ id: 'live', label: 'Live', ts: 1000 }]);
  });
});
