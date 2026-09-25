import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { feedText, formatClock } from './events.js';
import { applyEvent, applyEvents, initialState, stateFromSnapshot, type RadarState } from './reducer.js';
import { type RadarEvent, StateRes } from './schemas.js';
import { bobTimeline, compareIds, fileTree, memberStatus, needsYouCount, pendingDecisions, tasksByColumn } from './selectors.js';

interface Step {
  delayMs: number;
  actor: string;
  type: string;
  payload: unknown;
}

const T0 = Date.UTC(2026, 8, 26, 13, 0, 0); // 21:00 WITA
const scenario = JSON.parse(
  readFileSync(new URL('../../../scripts/mock-scenarios/demo.json', import.meta.url), 'utf8'),
) as { steps: Step[] };

/** Same mapping as scripts/mock-server.ts: ids from 1, ts = T0 + cumulative delay. */
function toEvents(steps: readonly Step[]): RadarEvent[] {
  let ts = T0;
  return steps.map((s, i) => {
    ts += s.delayMs;
    return { id: i + 1, ts, actor: s.actor, type: s.type, payload: s.payload } as RadarEvent;
  });
}

const events = toEvents(scenario.steps);
const final = applyEvents(initialState(), events);

describe('reducer on the demo scenario (PRD §15)', () => {
  it('every scenario step is a valid event', () => {
    const bad = events.filter((e) => applyEvent(initialState(), e).feed.length === 0 && !['bob.activity', 'sync.applied'].includes(e.type));
    expect(bad.map((e) => `${e.id} ${e.type}`)).toEqual([]);
    expect(final.cursor).toBe(events.length);
  });

  it('ends with T-0 in review and T-1/T-2 in progress', () => {
    expect(final.tasks['T-0']?.status).toBe('review');
    expect(final.tasks['T-1']?.status).toBe('dikerjakan');
    expect(final.tasks['T-2']?.status).toBe('dikerjakan');
  });

  it('checkout.ts is held by A for T-1 with T-2 queued', () => {
    expect(final.locks['src/checkout/checkout.ts']).toMatchObject({ memberId: 'A', taskId: 'T-1', state: 'dipegang', queue: ['T-2'] });
    expect(final.locks['src/checkout/shipping.ts']?.state).toBe('review');
  });

  it('records the request and proposal outcomes', () => {
    expect(final.requests['R-1']).toMatchObject({ status: 'diputuskan', outcome: 'antre' });
    expect(final.proposals['P-1']?.status).toBe('disetujui');
    expect(final.proposals['P-3']?.status).toBe('diterapkan_otomatis');
    expect(final.proposals['P-2']?.status).toBe('menunggu');
  });

  it('B is no longer blocked after the allowed Header.tsx edit', () => {
    expect(final.members.B?.blocked).toBe(false);
    expect(final.members.A?.activeTaskId).toBe('T-1');
  });

  it('feed is newest first and formatted HH:mm WITA', () => {
    expect(final.feed.length).toBeGreaterThan(20);
    expect(final.feed[0]!.id).toBeGreaterThan(final.feed.at(-1)!.id);
    expect(final.feed.some((f) => /^\d\d:\d\d Bob B diblokir di checkout\.ts \(milik A\)$/.test(f.text))).toBe(true);
  });

  it('is deterministic: replaying the same events twice gives the same state', () => {
    expect(applyEvents(initialState(), events)).toEqual(final);
  });

  it('skips events at or below the cursor (snapshot + overlapping live events)', () => {
    const half = applyEvents(initialState(), events.slice(0, 30));
    const resumed = applyEvents(half, events.slice(20));
    expect(resumed).toEqual(final);
  });

  it('unknown event types only advance the cursor', () => {
    const s = applyEvent(final, { id: 9999, ts: T0, actor: 'x', type: 'future.thing', payload: {} } as unknown as RadarEvent);
    expect(s.cursor).toBe(9999);
    expect(s.feed).toBe(final.feed);
    expect(s.tasks).toBe(final.tasks);
  });
});

describe('reducer edge cases', () => {
  const ev = (id: number, type: string, payload: unknown, ts = T0 + id): RadarEvent =>
    ({ id, ts, actor: 'server', type, payload }) as RadarEvent;

  const held: RadarState = applyEvents(initialState(), [
    ev(1, 'lock.acquired', { path: 'a.ts', taskId: 'T-1', memberId: 'A', auto: false }),
    ev(2, 'lock.queued', { path: 'a.ts', taskId: 'T-2', memberId: 'B', pos: 1 }),
    ev(3, 'lock.queued', { path: 'a.ts', taskId: 'T-3', memberId: 'D', pos: 1 }),
  ]);

  it('lock.queued inserts at pos - 1', () => {
    expect(held.locks['a.ts']?.queue).toEqual(['T-3', 'T-2']);
  });

  it('lock.released keeps the entry while someone is queued; transferred hands it over', () => {
    const released = applyEvent(held, ev(4, 'lock.released', { path: 'a.ts', taskId: 'T-1' }));
    expect(released.locks['a.ts']).toBeDefined();
    const moved = applyEvent(released, ev(5, 'lock.transferred', { path: 'a.ts', toTaskId: 'T-3', toMemberId: 'D', cause: 'queue' }));
    expect(moved.locks['a.ts']).toMatchObject({ taskId: 'T-3', state: 'dipesan', queue: ['T-2'] });
  });

  it('pindahkan puts the previous holder at the front of the queue', () => {
    const moved = applyEvent(
      held,
      ev(4, 'lock.transferred', { path: 'a.ts', fromTaskId: 'T-1', toTaskId: 'T-2', toMemberId: 'B', cause: 'decision' }),
    );
    expect(moved.locks['a.ts']).toMatchObject({ taskId: 'T-2', queue: ['T-1', 'T-3'] });
  });

  it('lock.released with an empty queue removes the lock', () => {
    const s = applyEvents(initialState(), [
      ev(1, 'lock.acquired', { path: 'b.ts', taskId: 'T-1', memberId: 'A', auto: true }),
      ev(2, 'lock.released', { path: 'b.ts', taskId: 'T-1' }),
    ]);
    expect(s.locks['b.ts']).toBeUndefined();
  });

  it('a finished task leaves every queue', () => {
    const s = applyEvents(held, [
      ev(4, 'task.created', { taskId: 'T-2', title: 't', ownerId: 'B', status: 'dikerjakan', files: [], adhoc: false }),
      ev(5, 'task.status', { taskId: 'T-2', from: 'dikerjakan', to: 'batal', by: 'C' }),
    ]);
    expect(s.locks['a.ts']?.queue).toEqual(['T-3']);
  });

  it('file.changed sets writingUntil = ts + 3000 and bumps editCount', () => {
    const s = applyEvents(initialState(), [
      ev(1, 'task.created', { taskId: 'T-1', title: 't', ownerId: 'A', status: 'dikerjakan', files: ['a.ts'], adhoc: false }),
      ev(2, 'member.created', { memberId: 'A' }),
      ev(3, 'file.changed', { path: 'a.ts', version: 1, hash: 'h', by: 'A', taskId: 'T-1', size: 3 }, T0),
    ]);
    expect(s.files['a.ts']?.writingUntil).toBe(T0 + 3000);
    expect(s.tasks['T-1']?.editCount).toBe(1);
    expect(memberStatus(s, 'A', T0 + 2999)).toBe('writing');
    expect(memberStatus(s, 'A', T0 + 3000)).toBe('idle');
    expect(memberStatus(s, 'nobody', T0)).toBe('idle');
  });
});

describe('selectors', () => {
  it('compareIds sorts naturally', () => {
    expect(['T-10', 'T-2', 'T-1'].sort(compareIds)).toEqual(['T-1', 'T-2', 'T-10']);
  });

  it('tasksByColumn, pendingDecisions and needsYouCount on the demo end state', () => {
    const cols = tasksByColumn(final);
    expect(cols.review.map((t) => t.id)).toEqual(['T-0']);
    expect(cols.dikerjakan.map((t) => t.id)).toEqual(['T-1', 'T-2']);
    expect(cols.draf).toEqual([]);
    expect(pendingDecisions(final).map((p) => p.id)).toEqual(['P-2']);
    expect(needsYouCount(final)).toBe(1);
  });

  it('a pending plan proposal shows up as draft cards', () => {
    const upToPlan = applyEvents(initialState(), events.filter((e) => e.type === 'proposal.created').slice(0, 1));
    const cols = tasksByColumn(upToPlan);
    expect(cols.draf.map((d) => d.ref).length).toBe(3);
    expect(cols.draf.every((d) => d.proposalId === 'P-1')).toBe(true);
  });

  it('needsYouCount counts stale members holding a lock', () => {
    const last = final.cursor;
    const s = applyEvent(final, { id: last + 1, ts: T0, actor: 'server', type: 'member.stale', payload: { memberId: 'A', lastHeartbeat: T0 } });
    expect(needsYouCount(s)).toBe(2);
  });

  it('bobTimeline is oldest first for one member', () => {
    const tl = bobTimeline(final, 'B');
    expect(tl.length).toBeGreaterThan(0);
    expect(tl[0]!.id).toBeLessThan(tl.at(-1)!.id);
    expect(tl.some((i) => i.kind === 'tool.pre' && i.decision === 'block')).toBe(true);
  });

  it('fileTree lists directories first and carries lock state', () => {
    const tree = fileTree(final);
    const src = tree.children.find((c) => c.name === 'src');
    expect(src?.kind).toBe('dir');
    const checkout = src?.children.find((c) => c.name === 'checkout');
    const file = checkout?.children.find((c) => c.name === 'checkout.ts');
    expect(file?.lockState).toBe('dipegang');
    const kinds = src?.children.map((c) => c.kind) ?? [];
    expect(kinds.indexOf('file') === -1 || kinds.lastIndexOf('dir') < kinds.indexOf('file')).toBe(true);
  });
});

describe('stateFromSnapshot', () => {
  it('builds keyed state and rebuilds feed from recentEvents', () => {
    const res = StateRes.parse({
      workspace: final.workspace,
      members: Object.values(final.members),
      tasks: Object.values(final.tasks),
      locks: Object.values(final.locks),
      files: Object.values(final.files),
      requests: Object.values(final.requests),
      proposals: Object.values(final.proposals),
      recentEvents: [...events.slice(-10), { id: 1e6, type: 'future.thing' }],
      cursor: final.cursor,
    });
    const s = stateFromSnapshot(res);
    expect(s.tasks).toEqual(final.tasks);
    expect(s.locks).toEqual(final.locks);
    expect(s.cursor).toBe(final.cursor);
    expect(s.feed.length).toBeGreaterThan(0);
    expect(s.feed[0]!.id).toBeGreaterThan(s.feed.at(-1)!.id);
  });
});

describe('feedText', () => {
  it('formats the clock in WITA (UTC+8)', () => {
    expect(formatClock(Date.UTC(2026, 8, 26, 13, 6))).toBe('21:06');
    expect(formatClock(Date.UTC(2026, 8, 26, 16, 30))).toBe('00:30');
  });

  it('writes the PRD feed lines and hides noisy events', () => {
    const ts = Date.UTC(2026, 8, 26, 13, 6);
    expect(
      feedText({ id: 1, ts, actor: 'A', type: 'file.changed', payload: { path: 'src/checkout/checkout.ts', version: 2, hash: 'h', by: 'A', taskId: 'T-1', size: 1 } }),
    ).toBe('21:06 Bob A ubah checkout.ts');
    expect(feedText({ id: 2, ts, actor: 'A', type: 'bob.turn', payload: { memberId: 'A' } })).toBeNull();
  });
});
