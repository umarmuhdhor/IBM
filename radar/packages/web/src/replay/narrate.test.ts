import { describe, expect, it } from 'vitest';
import type { RadarEvent } from '@radar/common';
import { buildBeats, currentBeat, narrate } from './narrate.js';

function ev(id: number, ts: number, type: string, payload: unknown = {}, actor = 'server'): RadarEvent {
  return { id, ts, actor, type, payload } as unknown as RadarEvent;
}

const NAMES = { A: 'Andi', B: 'Budi', C: 'Citra' };

describe('narrate', () => {
  it('turns a hook block into a near-miss beat that names both people and the file', () => {
    const beat = narrate(
      ev(9, 30_400, 'lock.blocked', {
        path: 'src/checkout/checkout.ts',
        memberId: 'B',
        holderMemberId: 'A',
        via: 'hook',
      }),
      NAMES,
    );
    expect(beat).not.toBeNull();
    expect(beat?.tone).toBe('block');
    expect(beat?.major).toBe(true);
    expect(beat?.text).toMatch(/Budi's Bob/);
    expect(beat?.text).toMatch(/blocked/i);
    expect(beat?.text).toMatch(/Andi/);
    expect(beat?.file).toBe('src/checkout/checkout.ts');
  });

  it('quotes the human prompt a coder gives their Bob', () => {
    const beat = narrate(
      ev(3, 10_000, 'bob.activity', { memberId: 'A', kind: 'prompt', mode: 'coder', text: 'tambahkan ongkir' }, 'A'),
      NAMES,
    );
    expect(beat?.major).toBe(true);
    expect(beat?.actor).toBe('A');
    expect(beat?.text).toBe('Andi asks their Bob for a change.');
    expect(beat?.quote).toBe('tambahkan ongkir');
  });

  it('describes the PM plan with its goal and task count', () => {
    const beat = narrate(
      ev(2, 3_500, 'proposal.created', { kind: 'plan', reason: 'no overlap', payload: { goal: 'Ongkir', tasks: [{}, {}, {}] } }, 'C'),
      NAMES,
    );
    expect(beat?.text).toMatch(/Citra's Bob/);
    expect(beat?.text).toMatch(/3 tasks/);
    expect(beat?.quote).toBe('Ongkir');
  });

  it('reports the queue position after a decision', () => {
    const beat = narrate(ev(5, 33_300, 'lock.queued', { path: 'src/a.ts', memberId: 'B', pos: 1 }), NAMES);
    expect(beat?.tone).toBe('ok');
    expect(beat?.text).toMatch(/Budi is #1 in the queue/);
  });

  it('skips pure bookkeeping events', () => {
    expect(narrate(ev(1, 0, 'member.created', { memberId: 'A', name: 'Andi' }), NAMES)).toBeNull();
  });

  it('falls back to the member id when a name is unknown', () => {
    const beat = narrate(ev(1, 0, 'member.online', { memberId: 'Z' }), NAMES);
    expect(beat?.text).toBe('Z comes online.');
  });
});

describe('buildBeats + currentBeat', () => {
  const events = [
    ev(1, 1000, 'member.created', { memberId: 'A', name: 'Andi', role: 'coder' }),
    ev(2, 1000, 'member.created', { memberId: 'B', name: 'Budi', role: 'coder' }),
    ev(3, 2000, 'member.online', { memberId: 'A' }),
    ev(4, 5000, 'bob.activity', { memberId: 'B', kind: 'prompt', mode: 'coder', text: 'x' }, 'B'),
    ev(5, 9000, 'lock.acquired', { path: 'a.ts', memberId: 'B' }),
  ];

  it('reads member names from the log itself', () => {
    const beats = buildBeats(events);
    expect(beats.map((b) => b.id)).toEqual([3, 4, 5]);
    expect(beats[1]?.text).toMatch(/^Budi asks/);
  });

  it('picks the latest major beat at or before the offset', () => {
    const beats = buildBeats(events);
    expect(currentBeat(beats, 1000, 0)).toBeNull();
    expect(currentBeat(beats, 1000, 4000)?.id).toBe(4);
    // lock.acquired is minor, so the prompt stays the headline
    expect(currentBeat(beats, 1000, 9000)?.id).toBe(4);
  });
});
