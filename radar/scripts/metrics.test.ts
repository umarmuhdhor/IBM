import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RadarEvent } from '../packages/common/src/index.js';
import { computeMetrics, hookLockCheckMs, percentile, renderMarkdown } from './metrics.js';

const flow = JSON.parse(
  readFileSync(
    new URL('../packages/server/test/fixtures/flow-export.json', import.meta.url),
    'utf8',
  ),
) as {
  events: RadarEvent[];
};

let nextId = 1;
const ev = (
  type: string,
  actor: string,
  payload: Record<string, unknown>,
  ts = nextId * 1000,
): RadarEvent => ({ id: nextId++, ts, actor, type, payload }) as unknown as RadarEvent;

describe('percentile', () => {
  it('uses the nearest-rank method and NaN for no data', () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(20);
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
    expect(percentile([], 95)).toBeNaN();
  });
});

describe('computeMetrics on the fase 05 flow export', () => {
  const m = computeMetrics(flow.events);

  it('counts blocks, requests, decisions, reviews and commits', () => {
    expect(m.blocks.total).toBe(5);
    expect(m.blocks.rejectedWrites).toBe(1);
    expect(m.requests).toMatchObject({ created: 1, decided: 1, auto: 1 });
    expect(m.commits).toMatchObject({ total: 1, pushed: 0 });
    expect(m.reviews.created).toBe(1);
  });

  it('measures block → decision per request', () => {
    expect(m.requests.decisionMs.n).toBe(1);
    expect(m.requests.decisionMs.median).toBeGreaterThanOrEqual(0);
  });

  it('finds no two-writer violations: every file.changed is by the lock holder', () => {
    expect(m.writers.changes).toBe(1);
    expect(m.writers.violations).toEqual([]);
  });
});

describe('two-writer audit', () => {
  it('flags a file.changed by someone who does not hold the lock', () => {
    const events = [
      ev('lock.acquired', 'A', { path: 'a.ts', taskId: 'T-1', memberId: 'A', auto: false }),
      ev('file.changed', 'B', {
        path: 'a.ts',
        version: 2,
        hash: 'x',
        by: 'B',
        taskId: 'T-2',
        size: 1,
      }),
    ];
    const m = computeMetrics(events);
    expect(m.writers.violations).toHaveLength(1);
    expect(m.writers.violations[0]).toMatchObject({ path: 'a.ts', by: 'B', holder: 'A' });
  });

  it('follows reserve, transfer, release and revoke', () => {
    const events = [
      ev('lock.reserved', 'server', { path: 'a.ts', taskId: 'T-1', memberId: 'A', source: 'plan' }),
      ev('file.changed', 'A', {
        path: 'a.ts',
        version: 2,
        hash: 'x',
        by: 'A',
        taskId: 'T-1',
        size: 1,
      }),
      ev('lock.transferred', 'server', {
        path: 'a.ts',
        fromTaskId: 'T-1',
        toTaskId: 'T-2',
        toMemberId: 'B',
        cause: 'queue',
      }),
      ev('file.changed', 'B', {
        path: 'a.ts',
        version: 3,
        hash: 'y',
        by: 'B',
        taskId: 'T-2',
        size: 1,
      }),
      ev('lock.revoked', 'mc', { path: 'a.ts', taskId: 'T-2', memberId: 'B', reason: 'x' }),
      ev('file.changed', 'A', {
        path: 'a.ts',
        version: 4,
        hash: 'z',
        by: 'A',
        taskId: null,
        size: 1,
      }),
    ];
    const m = computeMetrics(events);
    expect(m.writers.changes).toBe(3);
    expect(m.writers.violations).toEqual([]);
    // the last write happened with no holder at all: reported separately, not as a second writer
    expect(m.writers.unlocked).toBe(1);
  });
});

describe('latency series', () => {
  it('summarises sync.applied latency', () => {
    const events = [10, 20, 30, 400].map((latencyMs, i) =>
      ev('sync.applied', 'B', { path: 'a.ts', version: i + 2, memberId: 'B', latencyMs }),
    );
    const m = computeMetrics(events);
    expect(m.sync).toMatchObject({ n: 4, p50: 20, p95: 400, max: 400 });
  });

  it('takes lock-check latency from optional metric rows', () => {
    const m = computeMetrics([], {
      metricRows: [
        { name: 'lock_check_ms', value: 3 },
        { name: 'lock_check_ms', value: 9 },
        { name: 'other', value: 99 },
      ],
    });
    expect(m.lockCheck).toMatchObject({ n: 2, p95: 9 });
  });

  it('reports review.flagged', () => {
    const m = computeMetrics([
      ev('review.flagged', 'C', {
        reviewId: 'P-3',
        taskId: 'T-1',
        flags: [{ path: 'b.ts', issue: 'x' }],
      }),
    ]);
    expect(m.reviews.flagged).toBe(1);
  });
});

describe('hookLockCheckMs', () => {
  it('reads the end-to-end lock_guard durations from .radar/hook.log', () => {
    const log = [
      '2026-09-26T08:21:21.100Z lock_guard decision=allow tool=apply_diff ms=41',
      '2026-09-26T08:21:22.100Z lock_guard decision=block tool=write_to_file ms=58',
      '2026-09-26T08:21:23.100Z mark_ai_edit ai-edits not sent: Error: POST /v1/ai-edits → 404',
      '2026-09-26T08:21:24.100Z lock_guard locks/check failed: timeout',
    ].join('\n');
    expect(hookLockCheckMs(log)).toEqual([41, 58]);
  });

  it('feeds the lock-check series when given, instead of server metric rows', () => {
    const m = computeMetrics([], { hookMs: [41, 58, 300] });
    expect(m.lockCheck).toMatchObject({ n: 3, p95: 300, source: 'hook' });
  });
});

describe('renderMarkdown', () => {
  it('prints one row per PRD §04 metric and says when data is missing', () => {
    const md = renderMarkdown(computeMetrics(flow.events));
    expect(md).toContain('| Metrik |');
    expect(md).toContain('Dua penulis bersamaan');
    expect(md).toContain('Blokir → keputusan');
    expect(md).toContain('tidak ada data');
  });
});
