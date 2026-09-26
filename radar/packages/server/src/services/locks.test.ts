// checkWrite decision table tests (R4 §3, fase 05). One `it` per row.
// Run: cd radar/packages/server && pnpm exec vitest run src/services/locks.test.ts
import { COMMIT_CLAIM_TTL_MS } from '@radar/common';
import { describe, expect, it } from 'vitest';
import { getLock } from '../db/repo/lock';
import { getMember } from '../db/repo/member';
import { findOpenRequest } from '../db/repo/request';
import { getTask } from '../db/repo/task';
import { withLocks } from '../../test/lock-fixture';
import { checkWrite } from './locks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** One `checkWrite` call wrapped in a fixture (shorthand used in most rows). */
function check(
  f: Parameters<Parameters<typeof withLocks>[0]>[0],
  memberId: string,
  path: string,
  via: 'hook' | 'sync' = 'hook',
) {
  return checkWrite(f.ctx, memberId, path, via);
}

// ---------------------------------------------------------------------------
// Row 1 — ignored path
// ---------------------------------------------------------------------------

describe('row 1 — ignored path', () => {
  it('allows a path matched by the server .gitignore without touching the DB', async () => {
    await withLocks(
      (f) => {
        const r = check(f, 'A', 'notes/todo.md');
        expect(r).toMatchObject({ decision: 'allow', reason: 'ignored_path' });
        expect(getLock(f.db, 'notes/todo.md')).toBeNull();
        expect(f.events()).toEqual([]);
      },
      [{ path: '.gitignore', content: 'notes/\n' }],
    );
  });

  it('also allows a node_modules path (default ignores) with no lock created', async () => {
    await withLocks((f) => {
      const r = check(f, 'A', 'node_modules/lodash/index.js');
      expect(r.decision).toBe('allow');
      expect(r.reason).toBe('ignored_path');
      expect(getLock(f.db, 'node_modules/lodash/index.js')).toBeNull();
      expect(f.events()).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Row 2 — PM is read-only
// ---------------------------------------------------------------------------

describe('row 2 — PM is read-only', () => {
  it('blocks C (pm) without creating a request or a lock row', async () => {
    await withLocks((f) => {
      const r = check(f, 'C', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'block', reason: 'pm_readonly' });
      expect(getLock(f.db, 'src/app.ts')).toBeNull();
      expect(f.count("SELECT count(*) AS n FROM request WHERE requester_member = 'C'")).toBe(0);
      expect(f.events()).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Row 3 — file free, no queue → auto-grab
// ---------------------------------------------------------------------------

describe('row 3 — file free, auto-grab', () => {
  it('grabs a free file for A (existing open task), emits lock.acquired {auto:true}', async () => {
    await withLocks((f) => {
      const t = f.task('A');
      const r = check(f, 'A', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'allow', reason: 'grabbed', taskId: t.id });
      const lock = getLock(f.db, 'src/app.ts');
      expect(lock).toMatchObject({ task_id: t.id, member_id: 'A', state: 'dipegang' });
      // task advances terbuka → dikerjakan, so task.status fires before lock.acquired
      expect(getTask(f.db, t.id)?.status).toBe('dikerjakan');
      expect(f.events()).toEqual(['task.status', 'lock.acquired']);
      const acqEvent = f.ctx.uow.events.find((e) => e.type === 'lock.acquired');
      expect(acqEvent?.payload).toMatchObject({ auto: true, memberId: 'A' });
    });
  });

  it('auto-grab creates an ad-hoc task when member has no task (extra case)', async () => {
    await withLocks((f) => {
      // A has no tasks at all
      const r = check(f, 'A', 'src/app.ts');
      expect(r.decision).toBe('allow');
      expect(r.reason).toBe('grabbed');
      const lock = getLock(f.db, 'src/app.ts');
      expect(lock?.state).toBe('dipegang');
      const task = getTask(f.db, r.taskId!);
      expect(task).toMatchObject({ adhoc: 1, status: 'dikerjakan', owner_id: 'A' });
      // task.created fires first, then lock.acquired
      expect(f.events()).toEqual(['task.created', 'lock.acquired']);
    });
  });
});

// ---------------------------------------------------------------------------
// Row 4 — dipesan by own task → dipegang
// ---------------------------------------------------------------------------

describe('row 4 — dipesan by own task → dipegang', () => {
  it('promotes own dipesan lock to dipegang, emits lock.acquired {auto:false}', async () => {
    await withLocks((f) => {
      const t = f.task('A');
      f.lock('src/app.ts', t, 'dipesan');
      const r = check(f, 'A', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'allow', reason: 'own', taskId: t.id });
      expect(getLock(f.db, 'src/app.ts')?.state).toBe('dipegang');
      // task was terbuka → dikerjakan, so task.status fires after lock.acquired, then markTaskWorking fires again (no-op for status)
      expect(f.events()).toContain('lock.acquired');
      const acqEvent = f.ctx.uow.events.find((e) => e.type === 'lock.acquired');
      expect(acqEvent?.payload).toMatchObject({ auto: false });
    });
  });
});

// ---------------------------------------------------------------------------
// Row 5 — dipegang by own task → allow own (no state change)
// ---------------------------------------------------------------------------

describe('row 5 — dipegang by own task', () => {
  it('returns own on an already-held lock without any event or state change', async () => {
    await withLocks((f) => {
      const t = f.task('A', 'dikerjakan');
      f.lock('src/app.ts', t, 'dipegang');
      const r = check(f, 'A', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'allow', reason: 'own', taskId: t.id });
      expect(getLock(f.db, 'src/app.ts')?.state).toBe('dipegang');
      // No lock.acquired because it was already dipegang — only task.status if terbuka→dikerjakan
      // task is already dikerjakan so no task.status event either
      expect(f.events()).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Row 6 — dipegang by a different task of the same member
// ---------------------------------------------------------------------------

describe('row 6 — dipegang by another task of the same member', () => {
  it('allows and switches active_task to the task that holds the lock', async () => {
    await withLocks((f) => {
      const t1 = f.task('A', 'dikerjakan');
      const t2 = f.task('A', 'dikerjakan');
      f.lock('src/app.ts', t2, 'dipegang');
      // active_task is t1
      f.db.run('UPDATE member SET active_task_id = ? WHERE id = ?', t1.id, 'A');
      const r = check(f, 'A', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'allow', reason: 'own', taskId: t2.id });
      expect(getMember(f.db, 'A')?.active_task_id).toBe(t2.id);
    });
  });
});

// ---------------------------------------------------------------------------
// Row 7 — review by own task → task back to dikerjakan
// ---------------------------------------------------------------------------

describe('row 7 — review lock by own task', () => {
  it('returns task to dikerjakan, expires pending reviews, emits task.status', async () => {
    await withLocks((f) => {
      const t = f.task('A', 'review');
      f.lock('src/app.ts', t, 'review');
      const r = check(f, 'A', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'allow', reason: 'own', taskId: t.id });
      expect(getLock(f.db, 'src/app.ts')?.state).toBe('dipegang');
      expect(getTask(f.db, t.id)?.status).toBe('dikerjakan');
      expect(f.events()).toContain('task.status');
    });
  });
});

// ---------------------------------------------------------------------------
// Row 8 — dipesan by other → reserved_by_other
// ---------------------------------------------------------------------------

describe('row 8 — dipesan by other member', () => {
  it('blocks A, creates a request and a block row, reason reserved_by_other', async () => {
    await withLocks((f) => {
      const tB = f.task('B', 'dikerjakan');
      f.lock('src/app.ts', tB, 'dipesan');
      const tA = f.task('A');
      const r = check(f, 'A', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'block', reason: 'reserved_by_other', requestId: expect.stringMatching(/^R-/) });
      expect(r.holder).toMatchObject({ memberId: 'B', taskId: tB.id, state: 'dipesan' });
      expect(f.count("SELECT count(*) AS n FROM request WHERE requester_task = ?", tA.id)).toBe(1);
      expect(f.count("SELECT count(*) AS n FROM block WHERE member_id = 'A'")).toBe(1);
      expect(f.events()).toEqual(expect.arrayContaining(['request.created', 'lock.blocked']));
    });
  });
});

// ---------------------------------------------------------------------------
// Row 9 — dipegang by other → held_by_other
// ---------------------------------------------------------------------------

describe('row 9 — dipegang by other member', () => {
  it('blocks A, creates a request + block row, reason held_by_other', async () => {
    await withLocks((f) => {
      const tB = f.task('B', 'dikerjakan');
      f.lock('src/app.ts', tB, 'dipegang');
      const tA = f.task('A');
      const r = check(f, 'A', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'block', reason: 'held_by_other', requestId: expect.stringMatching(/^R-/) });
      expect(r.holder).toMatchObject({ memberId: 'B', taskId: tB.id, state: 'dipegang' });
      expect(f.count("SELECT count(*) AS n FROM request WHERE requester_task = ?", tA.id)).toBe(1);
      expect(f.count("SELECT count(*) AS n FROM block WHERE member_id = 'A'")).toBe(1);
      expect(f.events()).toEqual(expect.arrayContaining(['request.created', 'lock.blocked']));
    });
  });
});

// ---------------------------------------------------------------------------
// Row 10 — review by other → in_review_by_other
// ---------------------------------------------------------------------------

describe('row 10 — in review by other member', () => {
  it('blocks A, reason in_review_by_other', async () => {
    await withLocks((f) => {
      const tB = f.task('B', 'review');
      f.lock('src/app.ts', tB, 'review');
      f.task('A');
      const r = check(f, 'A', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'block', reason: 'in_review_by_other' });
      expect(r.holder).toMatchObject({ memberId: 'B', state: 'review' });
      expect(f.events()).toEqual(expect.arrayContaining(['request.created', 'lock.blocked']));
    });
  });
});

// ---------------------------------------------------------------------------
// Row 11 — same block repeated 5× → 1 request, 5 block rows
// ---------------------------------------------------------------------------

describe('row 11 — repeated blocks deduplicate the request', () => {
  it('creates exactly 1 request but 5 block rows after 5 consecutive blocks', async () => {
    await withLocks((f) => {
      const tB = f.task('B', 'dikerjakan');
      f.lock('src/app.ts', tB, 'dipegang');
      const tA = f.task('A');

      for (let i = 0; i < 5; i++) {
        const r = check(f, 'A', 'src/app.ts');
        expect(r.decision).toBe('block');
        expect(r.reason).toBe('held_by_other');
        // Every call returns the same requestId
        expect(r.requestId).toMatch(/^R-/);
      }

      expect(f.count("SELECT count(*) AS n FROM request WHERE requester_task = ?", tA.id)).toBe(1);
      expect(f.count("SELECT count(*) AS n FROM block WHERE member_id = 'A' AND path = 'src/app.ts'")).toBe(5);

      // request.created fires only once; lock.blocked fires 5 times
      const evts = f.events();
      expect(evts.filter((e) => e === 'request.created')).toHaveLength(1);
      expect(evts.filter((e) => e === 'lock.blocked')).toHaveLength(5);

      // All 5 block rows share the same request_id
      const requestId = findOpenRequest(f.db, tA.id, 'src/app.ts')?.id;
      expect(f.count("SELECT count(*) AS n FROM block WHERE request_id = ?", requestId!)).toBe(5);
    });
  });
});

// ---------------------------------------------------------------------------
// Row 12 — active commit claim blocks everyone, including the owner
// ---------------------------------------------------------------------------

describe('row 12 — commit claim active', () => {
  it('blocks owner A (committing their own task) — no request created', async () => {
    await withLocks((f) => {
      const t = f.task('A', 'review');
      f.lock('src/app.ts', t, 'review');
      f.claim(t, 1000); // 1 s old — well within COMMIT_CLAIM_TTL_MS (60 s)
      const r = check(f, 'A', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'block', reason: 'committing' });
      expect(f.count("SELECT count(*) AS n FROM request")).toBe(0);
      expect(f.events()).toEqual([]);
    });
  });

  it("blocks a different member B on owner A's claimed file — no request", async () => {
    await withLocks((f) => {
      const t = f.task('A', 'review');
      f.lock('src/app.ts', t, 'review');
      f.claim(t, 1000);
      f.task('B');
      const r = check(f, 'B', 'src/app.ts');
      expect(r).toMatchObject({ decision: 'block', reason: 'committing' });
      expect(f.count("SELECT count(*) AS n FROM request")).toBe(0);
      expect(f.events()).toEqual([]);
    });
  });

  it('a stale claim (>= COMMIT_CLAIM_TTL_MS) does NOT block — file behaves as normal', async () => {
    await withLocks((f) => {
      const t = f.task('A', 'dikerjakan');
      f.lock('src/app.ts', t, 'dipegang');
      f.claim(t, COMMIT_CLAIM_TTL_MS); // exactly at the boundary → treated as free
      // A checks their own file — stale claim must not trigger 'committing'
      const r = check(f, 'A', 'src/app.ts');
      expect(r.decision).toBe('allow');
      expect(r.reason).toBe('own');
    });
  });
});

// ---------------------------------------------------------------------------
// Extra — queuePos is returned for a blocked member that is already in queue
// ---------------------------------------------------------------------------

describe('extra — queuePos in block result', () => {
  it('reports the correct queue position when the requester task is already queued', async () => {
    await withLocks((f) => {
      const tB = f.task('B', 'dikerjakan');
      f.lock('src/app.ts', tB, 'dipegang');
      const tA = f.task('A');
      const pos = f.queue('src/app.ts', tA); // manually add A to queue at pos 1
      const r = check(f, 'A', 'src/app.ts');
      expect(r.decision).toBe('block');
      expect(r.queuePos).toBe(pos);
    });
  });

  it('reports queuePos null when the requester task is not yet in the queue', async () => {
    await withLocks((f) => {
      const tB = f.task('B', 'dikerjakan');
      f.lock('src/app.ts', tB, 'dipegang');
      f.task('A');
      const r = check(f, 'A', 'src/app.ts');
      expect(r.decision).toBe('block');
      expect(r.queuePos).toBeNull();
    });
  });
});
