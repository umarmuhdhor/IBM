// Fase 05 step 11: random operation sequences on 3 members × 6 files; R2 §4 invariants I1–I10 must hold after
// every step. Each run executes inside one transaction on the real Durable Object SQLite and is rolled back, so
// all runs start from the same seeded workspace.
import { ProposalCreateReq, type DecisionOption, type ReviewVerdict } from '@radar/common';
import { runInDurableObject } from 'cloudflare:test';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/crypto';
import type { Db } from '../src/db/sql';
import type { MemberPrincipal } from '../src/http/auth';
import { RadarError } from '../src/http/errors';
import { applyUpdate, authorizeWriteLocks } from '../src/services/files';
import { checkWrite, revoke, type LockCtx } from '../src/services/locks';
import { createProposal, decideStart, finishCommit } from '../src/services/proposals';
import { cancelTask, submitTask } from '../src/services/tasks';
import { UnitOfWork } from '../src/services/uow';
import type { WorkspaceDO } from '../src/workspace-do';
import { freshWorkspace, seedTestWorkspace } from './helpers';

const FILES = ['src/f0.ts', 'src/f1.ts', 'src/f2.ts', 'src/f3.ts', 'src/f4.ts', 'src/f5.ts'];
const MEMBERS = ['A', 'B', 'C'] as const;
const PRINCIPALS: Record<string, MemberPrincipal> = {
  A: { kind: 'member', memberId: 'A', role: 'coder' },
  B: { kind: 'member', memberId: 'B', role: 'coder' },
  C: { kind: 'member', memberId: 'C', role: 'pm' },
};
const RUNS = 300;
const STEPS = 60;

type Op =
  | { op: 'check'; m: number; f: number }
  | { op: 'update'; m: number; f: number }
  | { op: 'submit'; t: number }
  | { op: 'plan'; tasks: { owner: number; files: number[]; queued: number[] }[] }
  | { op: 'decide'; p: number; approve: boolean; commitFails: boolean }
  | { op: 'decision'; r: number; option: DecisionOption; owner: number }
  | { op: 'review'; t: number; verdict: ReviewVerdict }
  | { op: 'cancel'; t: number }
  | { op: 'revoke'; f: number }
  | { op: 'tick'; ms: number };

const member = fc.nat({ max: 2 });
const file = fc.nat({ max: FILES.length - 1 });
const idx = fc.nat({ max: 20 });
const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 5, arbitrary: fc.record({ op: fc.constant('check' as const), m: member, f: file }) },
  { weight: 5, arbitrary: fc.record({ op: fc.constant('update' as const), m: member, f: file }) },
  { weight: 2, arbitrary: fc.record({ op: fc.constant('submit' as const), t: idx }) },
  {
    weight: 2,
    arbitrary: fc.record({
      op: fc.constant('plan' as const),
      tasks: fc.array(
        fc.record({ owner: fc.nat({ max: 1 }), files: fc.uniqueArray(file, { maxLength: 3 }), queued: fc.uniqueArray(file, { maxLength: 2 }) }),
        { minLength: 1, maxLength: 3 },
      ),
    }),
  },
  { weight: 4, arbitrary: fc.record({ op: fc.constant('decide' as const), p: idx, approve: fc.boolean(), commitFails: fc.boolean() }) },
  { weight: 2, arbitrary: fc.record({ op: fc.constant('decision' as const), r: idx, option: fc.constantFrom<DecisionOption>('antre', 'pindahkan', 'pecah'), owner: fc.nat({ max: 1 }) }) },
  { weight: 2, arbitrary: fc.record({ op: fc.constant('review' as const), t: idx, verdict: fc.constantFrom<ReviewVerdict>('setujui', 'setujui_beri_tahu', 'kembalikan') }) },
  { weight: 1, arbitrary: fc.record({ op: fc.constant('cancel' as const), t: idx }) },
  { weight: 1, arbitrary: fc.record({ op: fc.constant('revoke' as const), f: file }) },
  { weight: 1, arbitrary: fc.record({ op: fc.constant('tick' as const), ms: fc.integer({ min: 1, max: 90_000 }) }) },
);

const ids = (db: Db, sql: string): string[] => db.all<{ id: string }>(sql).map((r) => r.id);
const pick = <T>(xs: readonly T[], i: number): T | undefined => (xs.length === 0 ? undefined : xs[i % xs.length]);

function apply(db: Db, uow: UnitOfWork, now: number, o: Op, seq: number): void {
  const ctx: LockCtx = { db, uow, now };
  switch (o.op) {
    case 'check':
      checkWrite(ctx, MEMBERS[o.m]!, FILES[o.f]!, 'hook');
      return;
    case 'update': {
      const path = FILES[o.f]!;
      const before = db.one<{ version: number }>('SELECT version FROM file WHERE path = ?', path)?.version ?? 0;
      const content = `// ${path} v${seq}\n`;
      const r = applyUpdate(db, uow, { now, authorizeWrite: authorizeWriteLocks }, PRINCIPALS[MEMBERS[o.m]!]!, { path, baseVersion: before, content, hash: sha256Hex(content) });
      const after = db.one<{ version: number }>('SELECT version FROM file WHERE path = ?', path)?.version ?? 0;
      if (r.ok && r.changed) {
        // I2: an accepted update comes from the lock holder; I6: exactly one version per accepted update.
        expect(db.one<{ member_id: string }>('SELECT member_id FROM lock WHERE path = ?', path)?.member_id).toBe(MEMBERS[o.m]);
        expect(after).toBe(before + 1);
      } else {
        expect(after).toBe(before);
      }
      return;
    }
    case 'submit': {
      const t = pick(db.all<{ id: string; owner_id: string }>('SELECT id, owner_id FROM task ORDER BY created_at, id'), o.t);
      if (t) submitTask(ctx, t.owner_id, t.id, 'selesai dikerjakan');
      return;
    }
    case 'plan': {
      const req = ProposalCreateReq.safeParse({
        kind: 'plan',
        reason: 'acak',
        payload: {
          goal: 'acak',
          tasks: o.tasks.map((t, i) => ({ ref: `r${i}`, title: `Task ${seq}.${i}`, ownerId: MEMBERS[t.owner], files: t.files.map((f) => FILES[f]), queuedFiles: t.queued.map((f) => FILES[f]) })),
        },
      });
      if (req.success) createProposal(ctx, 'C', req.data, true);
      return;
    }
    case 'decide': {
      const p = pick(ids(db, "SELECT id FROM proposal WHERE status = 'menunggu' ORDER BY created_at, id"), o.p);
      if (!p) return;
      const res = decideStart(ctx, p, { approve: o.approve });
      if (!('claim' in res)) return;
      // The committer runs between Tx1 and Tx2; here both happen in this step (success) or the claim is dropped.
      if (o.commitFails) db.run('UPDATE task SET commit_started_at = NULL WHERE id = ?', res.claim.taskId);
      else finishCommit(ctx, res.claim, { sha: `sha${seq}`, pushed: false });
      return;
    }
    case 'decision': {
      const r = pick(ids(db, "SELECT id FROM request WHERE status = 'terbuka' ORDER BY created_at, id"), o.r);
      if (!r) return;
      const payload = o.option === 'pecah' ? { requestId: r, option: o.option, newTask: { title: `Pecahan ${seq}`, ownerId: MEMBERS[o.owner] } } : { requestId: r, option: o.option };
      createProposal(ctx, 'C', ProposalCreateReq.parse({ kind: 'decision', reason: 'acak', payload }), o.option === 'antre');
      return;
    }
    case 'review': {
      const t = pick(ids(db, "SELECT id FROM task WHERE status = 'review' ORDER BY created_at, id"), o.t);
      if (t) createProposal(ctx, 'C', ProposalCreateReq.parse({ kind: 'review', reason: 'acak', payload: { taskId: t, verdict: o.verdict, notify: [{ memberId: 'B', message: 'cek' }] } }), true);
      return;
    }
    case 'cancel': {
      const t = pick(ids(db, 'SELECT id FROM task ORDER BY created_at, id'), o.t);
      if (t) cancelTask(ctx, t);
      return;
    }
    case 'revoke':
      revoke(ctx, FILES[o.f]!, 'acak', 'mc');
      return;
    case 'tick':
      return;
  }
}

/** R2 §4 I1–I10 (I2 and I6 per update above, the rest here) plus lock owner = task owner. */
function assertInvariants(db: Db): void {
  const none = (name: string, sql: string) => expect(db.all(sql), name).toEqual([]);
  none('I1 one lock per path', 'SELECT path FROM lock GROUP BY path HAVING count(*) > 1');
  none('I3 lock task is active', "SELECT l.path FROM lock l JOIN task t ON t.id = l.task_id WHERE t.status NOT IN ('terbuka','dikerjakan','review')");
  none('I4 lock has head allocation', 'SELECT l.path FROM lock l LEFT JOIN allocation a ON a.path = l.path AND a.task_id = l.task_id AND a.queue_pos = 0 WHERE a.task_id IS NULL');
  none('I5 queue without gaps', 'SELECT path FROM allocation GROUP BY path HAVING min(queue_pos) != 0 OR max(queue_pos) != count(*) - 1 OR count(DISTINCT queue_pos) != count(*)');
  none('I6 every version kept', 'SELECT f.path FROM file f WHERE f.version != (SELECT count(*) FROM file_version v WHERE v.path = f.path) OR f.version != (SELECT max(version) FROM file_version v WHERE v.path = f.path)');
  none(
    'I7 decided by mc/auto/server only',
    "SELECT id FROM proposal WHERE (status IN ('disetujui','ditolak') AND decided_by != 'mc') OR (status = 'diterapkan_otomatis' AND (decided_by != 'auto' OR kind != 'decision')) OR (status = 'menunggu' AND decided_by IS NOT NULL)",
  );
  none('I8 pm never holds a lock', "SELECT l.path FROM lock l JOIN member m ON m.id = l.member_id WHERE m.role = 'pm'");
  none('I9 closed tasks hold nothing', "SELECT t.id FROM task t WHERE t.status IN ('selesai','batal') AND (EXISTS (SELECT 1 FROM lock l WHERE l.task_id = t.id) OR EXISTS (SELECT 1 FROM allocation a WHERE a.task_id = t.id))");
  none('I10 one active request per task+path', "SELECT requester_task, path FROM request WHERE status IN ('terbuka','diusulkan') GROUP BY requester_task, path HAVING count(*) > 1");
  none('lock member owns the task', 'SELECT l.path FROM lock l JOIN task t ON t.id = l.task_id WHERE t.owner_id != l.member_id');
}

const ROLLBACK = new Error('rollback');

/** What the runs reached, so a generator that never gets past the first refusal fails loudly. */
const seen = { refused: 0, selesai: 0, batal: 0, transferred: 0, queued: 0, accepted: 0 };

function countReached(db: Db): void {
  const n = (sql: string) => db.one<{ n: number }>(sql)?.n ?? 0;
  seen.selesai += n("SELECT count(*) AS n FROM task WHERE status = 'selesai'");
  seen.batal += n("SELECT count(*) AS n FROM task WHERE status = 'batal'");
  seen.transferred += n("SELECT count(*) AS n FROM event WHERE type = 'lock.transferred'");
  seen.queued += n("SELECT count(*) AS n FROM event WHERE type = 'lock.queued'");
  seen.accepted += n("SELECT count(*) AS n FROM event WHERE type = 'file.changed'");
}

describe('lock engine invariants (R2 §4, fase 05 step 11)', () => {
  it(`I1–I10 hold after every step (${RUNS} runs × ${STEPS} steps)`, { timeout: 120_000 }, async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(
      stub,
      FILES.map((path) => ({ path, content: `// ${path}\n` })),
    );
    await runInDurableObject(stub, (inst: WorkspaceDO) => {
      fc.assert(
        fc.property(fc.array(opArb, { minLength: STEPS, maxLength: STEPS }), (ops) => {
          try {
            inst.db.tx(() => {
              const uow = new UnitOfWork();
              let now = 2_000_000;
              ops.forEach((o, seq) => {
                if (o.op === 'tick') now += o.ms;
                else now += 1;
                try {
                  // Own savepoint per step, like one request = one transaction in production.
                  inst.ctx.storage.transactionSync(() => apply(inst.db, uow, now, o, seq));
                } catch (err) {
                  // Business rule refusals (403/404/409/422) are expected; anything else is a bug.
                  if (!(err instanceof RadarError)) throw err;
                  seen.refused++;
                }
                assertInvariants(inst.db);
              });
              countReached(inst.db);
              throw ROLLBACK;
            });
          } catch (err) {
            if (err !== ROLLBACK) throw err;
          }
        }),
        { numRuns: RUNS },
      );
      // Every run was rolled back: the seeded workspace is untouched.
      expect(inst.db.one<{ n: number }>('SELECT count(*) AS n FROM task')?.n).toBe(0);
    });
    for (const [k, v] of Object.entries(seen)) expect(v, k).toBeGreaterThan(5);
  });
});
