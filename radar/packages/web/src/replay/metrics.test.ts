import { describe, expect, it } from 'vitest';
import type { RadarEvent } from '@radar/common';
import { computeMetrics } from './metrics.js';

function ev(id: number, ts: number, type: string, payload: unknown, actor = 'server'): RadarEvent {
  return { id, ts, actor, type, payload } as unknown as RadarEvent;
}

describe('computeMetrics', () => {
  it('returns zeroes and a null median on an empty timeline', () => {
    expect(computeMetrics([])).toEqual({ nearMisses: 0, decisions: 0, mergeConflicts: 0, medianDecisionSeconds: null });
  });

  it('counts one near-miss per lock.blocked event', () => {
    const events = [
      ev(1, 1000, 'lock.blocked', { path: 'a.ts', memberId: 'B', taskId: 'T-2', holderMemberId: 'A', holderTaskId: 'T-1', via: 'hook', requestId: 'R-1' }),
      ev(2, 2000, 'lock.blocked', { path: 'b.ts', memberId: 'B', taskId: 'T-2', holderMemberId: 'A', holderTaskId: 'T-1', via: 'hook', requestId: 'R-2' }),
    ];
    expect(computeMetrics(events).nearMisses).toBe(2);
  });

  it('counts merge conflicts from commit.push_failed', () => {
    const events = [ev(1, 1000, 'commit.push_failed', { taskId: 'T-1', sha: null, error: 'NonFastForwardError' })];
    expect(computeMetrics(events).mergeConflicts).toBe(1);
  });

  it('counts decisions from proposal.decided, of any kind', () => {
    const events = [
      ev(1, 1000, 'proposal.decided', { proposalId: 'P-1', kind: 'plan', status: 'disetujui', by: 'mc', note: null }),
      ev(2, 2000, 'proposal.decided', { proposalId: 'P-3', kind: 'decision', status: 'diterapkan_otomatis', by: 'server', note: null }),
    ];
    expect(computeMetrics(events).decisions).toBe(2);
  });

  it('computes median decision latency by matching request.created to request.decided by requestId, in seconds', () => {
    const events = [
      ev(1, 30_350, 'request.created', { requestId: 'R-1', path: 'a.ts', requesterMemberId: 'B', requesterTaskId: 'T-2', holderMemberId: 'A', holderTaskId: 'T-1', source: 'hook' }),
      ev(2, 33_350, 'request.decided', { requestId: 'R-1', outcome: 'antre', proposalId: 'P-3', auto: true }),
    ];
    expect(computeMetrics(events).medianDecisionSeconds).toBe(3);
  });

  it('takes the middle value for an odd number of decision latencies', () => {
    const events = [
      ev(1, 0, 'request.created', { requestId: 'R-1', path: 'a.ts', requesterMemberId: 'B', requesterTaskId: 'T-2', holderMemberId: 'A', holderTaskId: 'T-1', source: 'hook' }),
      ev(2, 2_000, 'request.decided', { requestId: 'R-1', outcome: 'antre', proposalId: 'P-1', auto: true }),
      ev(3, 0, 'request.created', { requestId: 'R-2', path: 'b.ts', requesterMemberId: 'B', requesterTaskId: 'T-2', holderMemberId: 'A', holderTaskId: 'T-1', source: 'hook' }),
      ev(4, 10_000, 'request.decided', { requestId: 'R-2', outcome: 'antre', proposalId: 'P-2', auto: true }),
      ev(5, 0, 'request.created', { requestId: 'R-3', path: 'c.ts', requesterMemberId: 'B', requesterTaskId: 'T-2', holderMemberId: 'A', holderTaskId: 'T-1', source: 'hook' }),
      ev(6, 4_000, 'request.decided', { requestId: 'R-3', outcome: 'antre', proposalId: 'P-3', auto: true }),
    ];
    // latencies: 2s, 10s, 4s -> sorted 2,4,10 -> median 4
    expect(computeMetrics(events).medianDecisionSeconds).toBe(4);
  });

  it('only counts the first request.decided for a given requestId (one terminal outcome, R4 §2)', () => {
    const events = [
      ev(1, 0, 'request.created', { requestId: 'R-1', path: 'a.ts', requesterMemberId: 'B', requesterTaskId: 'T-2', holderMemberId: 'A', holderTaskId: 'T-1', source: 'hook' }),
      ev(2, 3_000, 'request.decided', { requestId: 'R-1', outcome: 'antre', proposalId: 'P-1', auto: true }),
      ev(3, 100_000, 'request.decided', { requestId: 'R-1', outcome: 'antre', proposalId: 'P-9', auto: false }),
    ];
    expect(computeMetrics(events).medianDecisionSeconds).toBe(3);
  });

  it('ignores a request.decided with no matching request.created', () => {
    const events = [ev(1, 5_000, 'request.decided', { requestId: 'R-9', outcome: 'antre', proposalId: null, auto: true })];
    expect(computeMetrics(events).medianDecisionSeconds).toBeNull();
  });
});
