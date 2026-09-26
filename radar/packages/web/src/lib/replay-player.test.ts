import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { initialState, type RadarEvent } from '@radar/common';
import { buildSnapshots, createPlayer, stateAtOffset } from './replay-player.js';

function ev(id: number, ts: number, type: string, payload: unknown, actor = 'server'): RadarEvent {
  return { id, ts, actor, type, payload } as unknown as RadarEvent;
}

// 5 file.changed events, one every 4s over 20s, so 10s snapshots land mid-stream.
const EVENTS: RadarEvent[] = [
  ev(1, 0, 'workspace.created', { workspaceId: 'toko-demo', headCommit: null, fileCount: 0 }),
  ev(2, 0, 'member.created', { memberId: 'A', name: 'Andi', role: 'coder' }),
  ev(3, 4_000, 'file.changed', { path: 'a.ts', version: 1, hash: 'h1', by: 'A', taskId: null, size: 10 }),
  ev(4, 8_000, 'file.changed', { path: 'b.ts', version: 1, hash: 'h2', by: 'A', taskId: null, size: 10 }),
  ev(5, 12_000, 'file.changed', { path: 'c.ts', version: 1, hash: 'h3', by: 'A', taskId: null, size: 10 }),
  ev(6, 16_000, 'file.changed', { path: 'd.ts', version: 1, hash: 'h4', by: 'A', taskId: null, size: 10 }),
  ev(7, 20_000, 'file.changed', { path: 'e.ts', version: 1, hash: 'h5', by: 'A', taskId: null, size: 10 }),
];

describe('buildSnapshots + stateAtOffset', () => {
  it('produces the same state seeking forward as replaying straight through', () => {
    const snapshots = buildSnapshots(EVENTS, 10_000);
    const direct = stateAtOffset(EVENTS, snapshots, 20_000);
    const full = stateAtOffset(EVENTS, [{ offsetMs: 0, state: initialState() }], 20_000);
    expect(direct.files).toEqual(full.files);
    expect(Object.keys(direct.files).sort()).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']);
  });

  it('seeking forward then back to an earlier offset matches a fresh replay to that offset', () => {
    const snapshots = buildSnapshots(EVENTS, 10_000);
    void stateAtOffset(EVENTS, snapshots, 20_000); // forward first
    const backTo6s = stateAtOffset(EVENTS, snapshots, 6_000);
    const fresh6s = stateAtOffset(EVENTS, [{ offsetMs: 0, state: initialState() }], 6_000);
    expect(backTo6s.files).toEqual(fresh6s.files);
    expect(Object.keys(backTo6s.files)).toEqual(['a.ts']);
  });

  it('an offset before the first event applies no events', () => {
    const snapshots = buildSnapshots(EVENTS, 10_000);
    const s = stateAtOffset(EVENTS, snapshots, -1);
    expect(s.files).toEqual({});
  });
});

describe('createPlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts paused at offset 0', () => {
    const player = createPlayer(EVENTS);
    expect(player.getOffsetMs()).toBe(0);
    expect(player.isPlaying()).toBe(false);
  });

  it('advances the offset by (elapsed * speed) once playing', () => {
    const player = createPlayer(EVENTS);
    player.setSpeed(2);
    player.play();
    vi.advanceTimersByTime(1_000);
    expect(player.getOffsetMs()).toBe(2_000);
  });

  it('pauses at the end of the timeline instead of overshooting', () => {
    const player = createPlayer(EVENTS);
    player.setSpeed(8);
    player.play();
    vi.advanceTimersByTime(10_000); // 80s of virtual time, timeline is only 20s
    expect(player.getOffsetMs()).toBe(20_000);
    expect(player.isPlaying()).toBe(false);
  });

  it('seek jumps the offset immediately without needing play()', () => {
    const player = createPlayer(EVENTS);
    player.seek(12_000);
    expect(player.getOffsetMs()).toBe(12_000);
    expect(Object.keys(player.getState().files)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });
});
