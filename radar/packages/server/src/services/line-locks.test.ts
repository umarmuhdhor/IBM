// Line-range locks (D-alief-17): the checkWrite rows R1–R8 and the file.update merge/conflict layer.
// Run: cd radar/packages/server && pnpm exec vitest run src/services/line-locks.test.ts
import type { LineRange } from '@radar/common';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../crypto';
import { getFile } from '../db/repo/file';
import { getLock } from '../db/repo/lock';
import type { MemberPrincipal } from '../http/auth';
import { withLocks, type LockFixture } from '../../test/lock-fixture';
import { blockMessage, checkPaths } from './check';
import { applyUpdate, authorizeWriteLocks } from './files';
import { checkWrite } from './locks';

const P = 'src/app.ts';
const r = (start: number, end: number): LineRange => ({ start, end });
const lines12 = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
const SEED = [{ path: P, content: lines12 }];
const A: MemberPrincipal = { kind: 'member', memberId: 'A', role: 'coder' };
const B: MemberPrincipal = { kind: 'member', memberId: 'B', role: 'coder' };

const lockRange = (f: LockFixture) => {
  const l = getLock(f.db, P);
  return l && l.start_line !== null ? r(Number(l.start_line), Number(l.end_line)) : null;
};
const payloads = (f: LockFixture, type: string) => f.ctx.uow.events.filter((e) => e.type === type).map((e) => e.payload as Record<string, unknown>);

describe('checkWrite with lines (D-alief-17 table)', () => {
  it('R1: free file + known lines → grabbed, lock covers the span', async () => {
    await withLocks((f) => {
      const res = checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      expect(res).toMatchObject({ decision: 'allow', reason: 'grabbed' });
      expect(lockRange(f)).toEqual(r(3, 5));
      expect(payloads(f, 'lock.acquired')[0]).toMatchObject({ path: P, memberId: 'A', range: r(3, 5) });
    }, SEED);
  });

  it('R2: free file + unknown lines → whole-file lock', async () => {
    await withLocks((f) => {
      expect(checkWrite(f.ctx, 'A', P, 'hook', null)).toMatchObject({ decision: 'allow', reason: 'grabbed' });
      expect(getLock(f.db, P)).not.toBeNull();
      expect(lockRange(f)).toBeNull();
      expect(payloads(f, 'lock.acquired')[0]?.range).toBeUndefined();
    }, SEED);
  });

  it('R3: own range + known lines → own, the range widens and lock.acquired says so', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      expect(checkWrite(f.ctx, 'A', P, 'hook', [r(9, 9)])).toMatchObject({ decision: 'allow', reason: 'own' });
      expect(lockRange(f)).toEqual(r(3, 9));
      expect(payloads(f, 'lock.acquired').at(-1)).toMatchObject({ range: r(3, 9) });
    }, SEED);
  });

  it('R4: own range + unknown lines → own, range unchanged', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      expect(checkWrite(f.ctx, 'A', P, 'hook', null)).toMatchObject({ decision: 'allow', reason: 'own' });
      expect(lockRange(f)).toEqual(r(3, 5));
    }, SEED);
  });

  it('R5: someone else holds 3–5, B edits line 10 → allowed outside the range, no lock, no request', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      const res = checkWrite(f.ctx, 'B', P, 'hook', [r(10, 10)]);
      expect(res).toMatchObject({ decision: 'allow', reason: 'outside_range', taskId: null });
      expect(getLock(f.db, P)?.member_id).toBe('A');
      expect(lockRange(f)).toEqual(r(3, 5));
      expect(f.count('SELECT count(*) AS n FROM request')).toBe(0);
      expect(f.count('SELECT count(*) AS n FROM block')).toBe(0);
    }, SEED);
  });

  it('R5: an edit that changes no line is outside every range', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      expect(checkWrite(f.ctx, 'B', P, 'sync', [])).toMatchObject({ decision: 'allow', reason: 'outside_range' });
    }, SEED);
  });

  it('R6: B edits line 4 inside Alice’s 3–5 → blocked, holder carries the range', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      const res = checkWrite(f.ctx, 'B', P, 'hook', [r(4, 4)]);
      expect(res).toMatchObject({ decision: 'block', reason: 'held_by_other' });
      expect(res.holder).toMatchObject({ memberId: 'A', range: r(3, 5) });
      expect(payloads(f, 'lock.blocked')[0]).toMatchObject({ memberId: 'B', holderMemberId: 'A', holderRange: r(3, 5) });
      expect(f.count('SELECT count(*) AS n FROM request')).toBe(1);
    }, SEED);
  });

  it('R7: range held by someone else + unknown lines → blocked', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      expect(checkWrite(f.ctx, 'B', P, 'hook', null)).toMatchObject({ decision: 'block', reason: 'held_by_other' });
    }, SEED);
  });

  it('R8: a whole-file lock still blocks every line', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', null);
      const res = checkWrite(f.ctx, 'B', P, 'hook', [r(10, 10)]);
      expect(res).toMatchObject({ decision: 'block', reason: 'held_by_other' });
      expect(res.holder?.range).toBeUndefined();
    }, SEED);
  });

  it('a commit claim blocks edits outside the range too', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      f.claim(f.db.one<{ id: string }>("SELECT task_id AS id FROM lock WHERE path = ?", P) as never);
      expect(checkWrite(f.ctx, 'B', P, 'hook', [r(10, 10)])).toMatchObject({ decision: 'block', reason: 'committing' });
    }, SEED);
  });

  it('the hook message names the lines and the holder', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      const res = checkPaths(f.ctx, 'B', [P], { [P]: [r(3, 3)] });
      expect(res.decision).toBe('block');
      expect(res.message).toContain('lines 3–5 are locked by Andi');
      const ok = checkPaths(f.ctx, 'B', [P], { [P]: [r(10, 10)] });
      expect(ok).toMatchObject({ decision: 'allow', message: '' });
      expect(ok.results[0]?.reason).toBe('outside_range');
    }, SEED);
  });

  it('blockMessage for a whole-file lock is plain English', () => {
    const msg = blockMessage([{ path: P, decision: 'block', reason: 'held_by_other', holder: { memberId: 'A', memberName: 'Andi', taskId: 'T-1', taskTitle: 'Kupon', state: 'dipegang' } }], 'T-2');
    expect(msg).toContain(`RADAR: ${P} is held by Andi's Bob (T-1 Kupon)`);
  });
});

describe('file.update with a range lock (second layer)', () => {
  const up = (f: LockFixture, who: MemberPrincipal, baseVersion: number, content: string) =>
    applyUpdate(f.db, f.ctx.uow, { now: f.ctx.now, authorizeWrite: authorizeWriteLocks }, who, { path: P, baseVersion, content, hash: sha256Hex(content) });
  const alice = lines12.replace('line 3\nline 4\nline 5\n', 'alice 3\nalice 4\nalice 5\n');

  it('B saves line 10 on the current version while Alice holds 3–5 → accepted, no lock for B', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      const a = up(f, A, 1, alice);
      expect(a).toMatchObject({ ok: true, version: 2 });
      const b = up(f, B, 2, alice.replace('line 10\n', 'budi 10\n'));
      expect(b).toMatchObject({ ok: true, version: 3, changed: true });
      expect(getLock(f.db, P)?.member_id).toBe('A');
      expect(getFile(f.db, P)?.content).toContain('budi 10');
      expect(getFile(f.db, P)?.content).toContain('alice 4');
    }, SEED);
  });

  it('B saves line 10 on a stale copy → three-way merge keeps both edits and returns the merged text', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      up(f, A, 1, alice);
      const b = up(f, B, 1, lines12.replace('line 10\n', 'budi 10\n'));
      expect(b.ok).toBe(true);
      if (!b.ok) return;
      expect(b.merged).toBe(true);
      expect(b.content).toContain('alice 4');
      expect(b.content).toContain('budi 10');
      expect(b.hash).toBe(sha256Hex(b.content));
      expect(getFile(f.db, P)?.content).toBe(b.content);
    }, SEED);
  });

  it('B saves line 4 on a stale copy → rejected held_by_other, nothing overwritten', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      up(f, A, 1, alice);
      const b = up(f, B, 1, lines12.replace('line 4\n', 'budi 4\n'));
      expect(b).toMatchObject({ ok: false, reason: 'held_by_other' });
      expect(getFile(f.db, P)?.content).toBe(alice);
    }, SEED);
  });

  it('B saves line 4 on the current copy → rejected held_by_other with the range', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      up(f, A, 1, alice);
      const b = up(f, B, 2, alice.replace('alice 4\n', 'budi 4\n'));
      expect(b).toMatchObject({ ok: false, reason: 'held_by_other' });
      if (!b.ok) expect(b.holder?.range).toEqual(r(3, 5));
      expect(getFile(f.db, P)?.content).toBe(alice);
    }, SEED);
  });

  it('overlapping stale edits outside the range still conflict, never silently overwrite', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      up(f, A, 1, alice);
      // Alice also changed line 10 through her own save (range widens to 3–10).
      const alice2 = alice.replace('line 10\n', 'alice 10\n');
      up(f, A, 2, alice2);
      const b = up(f, B, 1, lines12.replace('line 11\n', 'budi 11\n'));
      expect(b.ok).toBe(false);
      expect(getFile(f.db, P)?.content).toBe(alice2);
    }, SEED);
  });

  it('the holder’s own save widens the range to the lines it changed', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', [r(3, 5)]);
      up(f, A, 1, alice.replace('line 8\n', 'alice 8\n'));
      expect(lockRange(f)).toEqual(r(3, 8));
    }, SEED);
  });

  it('without a range lock a stale save is still rejected (SY-07)', async () => {
    await withLocks((f) => {
      checkWrite(f.ctx, 'A', P, 'hook', null);
      up(f, A, 1, alice);
      expect(up(f, B, 1, lines12.replace('line 10\n', 'budi 10\n'))).toMatchObject({ ok: false });
    }, SEED);
  });
});
