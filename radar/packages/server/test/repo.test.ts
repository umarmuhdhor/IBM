// Fase 05 step 1: repositories for tasks, allocations, locks, touches, blocks, requests, proposals, reviews
// and notifications, run against the real Durable Object SQLite.
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { deleteAllocation, getAllocation, headOf, insertAllocation, nextPos, pathsOf, queueOf, renumberQueue, setFront } from '../src/db/repo/allocation';
import { insertBlock, lastBlockFor } from '../src/db/repo/block';
import { deleteLock, getLock, insertLock, locksOfTask, setLockState, setTaskLocksState, updateLock } from '../src/db/repo/lock';
import { insertNotification, notificationsFor } from '../src/db/repo/notification';
import { decideProposal, expirePendingReviews, getProposal, insertProposal, listProposals } from '../src/db/repo/proposal';
import { createRequest, findOpenRequest, getRequest, listRequests, setRequestStatus } from '../src/db/repo/request';
import { insertReview } from '../src/db/repo/review';
import { firstOpenTask, getTask, insertTask, latestWorkingTask, listTasks, setCommitClaim, setTaskStatus } from '../src/db/repo/task';
import { moveTouch, touchesOf, upsertTouch } from '../src/db/repo/touch';
import type { Db } from '../src/db/sql';
import type { WorkspaceDO } from '../src/workspace-do';
import { freshWorkspace, seedTestWorkspace } from './helpers';

async function withDb<T>(fn: (db: Db) => T): Promise<T> {
  const { stub } = freshWorkspace();
  await seedTestWorkspace(stub, []);
  return runInDurableObject(stub, (instance: WorkspaceDO) => instance.db.tx(() => fn(instance.db)));
}

const task = (db: Db, owner: string, status: 'terbuka' | 'dikerjakan' = 'terbuka', now = 1) =>
  insertTask(db, { title: `task of ${owner}`, ownerId: owner, status, now });

describe('task repo', () => {
  it('numbers tasks T-1, T-2 and finds working and open tasks per owner', async () => {
    await withDb((db) => {
      const t1 = task(db, 'A', 'terbuka', 10);
      const t2 = task(db, 'A', 'terbuka', 20);
      const t3 = task(db, 'A', 'dikerjakan', 30);
      expect([t1.id, t2.id, t3.id]).toEqual(['T-1', 'T-2', 'T-3']);
      expect(t1).toMatchObject({ seq: 1, owner_id: 'A', status: 'terbuka', adhoc: 0, edit_count: 0 });
      expect(latestWorkingTask(db, 'A')?.id).toBe('T-3');
      expect(firstOpenTask(db, 'A')?.id).toBe('T-1');
      expect(latestWorkingTask(db, 'B')).toBeNull();
      setTaskStatus(db, 'T-1', 'batal', 40);
      expect(firstOpenTask(db, 'A')?.id).toBe('T-2');
      setCommitClaim(db, 'T-3', 55);
      expect(getTask(db, 'T-3')?.commit_started_at).toBe(55);
      expect(listTasks(db).map((t) => t.id)).toEqual(['T-1', 'T-2', 'T-3']);
    });
  });
});

describe('allocation repo', () => {
  it('keeps a gap-free queue per path (I5): nextPos, headOf, renumber, setFront', async () => {
    await withDb((db) => {
      const [a, b, c] = [task(db, 'A'), task(db, 'B'), task(db, 'A')];
      expect(nextPos(db, 'x.ts')).toBe(0);
      insertAllocation(db, { taskId: a.id, path: 'x.ts', pos: 0, source: 'plan', now: 1 });
      insertAllocation(db, { taskId: b.id, path: 'x.ts', pos: nextPos(db, 'x.ts'), source: 'plan', now: 1 });
      insertAllocation(db, { taskId: c.id, path: 'x.ts', pos: nextPos(db, 'x.ts'), source: 'decision', now: 1 });
      expect(headOf(db, 'x.ts')).toMatchObject({ task_id: a.id, owner_id: 'A', queue_pos: 0 });
      deleteAllocation(db, a.id, 'x.ts');
      renumberQueue(db, 'x.ts');
      expect(queueOf(db, 'x.ts').map((r) => [r.task_id, r.queue_pos])).toEqual([
        [b.id, 0],
        [c.id, 1],
      ]);
      setFront(db, 'x.ts', c.id, 'decision', 2);
      expect(queueOf(db, 'x.ts').map((r) => [r.task_id, r.queue_pos])).toEqual([
        [c.id, 0],
        [b.id, 1],
      ]);
      // setFront creates the allocation when the task had none.
      setFront(db, 'x.ts', a.id, 'decision', 3);
      expect(queueOf(db, 'x.ts').map((r) => r.task_id)).toEqual([a.id, c.id, b.id]);
      expect(getAllocation(db, a.id, 'x.ts')?.source).toBe('decision');
      expect(pathsOf(db, a.id)).toEqual(['x.ts']);
    });
  });
});

describe('lock repo', () => {
  it('inserts, moves and changes the state of locks, also per task', async () => {
    await withDb((db) => {
      const a = task(db, 'A');
      const b = task(db, 'B');
      insertLock(db, { path: 'a.ts', taskId: a.id, memberId: 'A', state: 'dipesan', now: 1 });
      insertLock(db, { path: 'b.ts', taskId: a.id, memberId: 'A', state: 'dipegang', now: 1 });
      expect(() => insertLock(db, { path: 'a.ts', taskId: b.id, memberId: 'B', state: 'dipesan', now: 1 })).toThrow();
      setLockState(db, 'a.ts', 'dipegang', 2);
      setTaskLocksState(db, a.id, 'review', 3);
      expect(locksOfTask(db, a.id).map((l) => [l.path, l.state])).toEqual([
        ['a.ts', 'review'],
        ['b.ts', 'review'],
      ]);
      updateLock(db, 'b.ts', { taskId: b.id, memberId: 'B', state: 'dipesan' }, 4);
      expect(getLock(db, 'b.ts')).toMatchObject({ task_id: b.id, member_id: 'B', state: 'dipesan', acquired_at: 4 });
      deleteLock(db, 'a.ts');
      expect(getLock(db, 'a.ts')).toBeNull();
    });
  });
});

describe('task_touch repo', () => {
  it('keeps first_version on later edits and carries it when a path moves task', async () => {
    await withDb((db) => {
      const a = task(db, 'A');
      const b = task(db, 'B');
      upsertTouch(db, { taskId: a.id, path: 'a.ts', firstVersion: 3, lastVersion: 4 });
      upsertTouch(db, { taskId: a.id, path: 'a.ts', firstVersion: 4, lastVersion: 6 });
      expect(touchesOf(db, a.id)).toEqual([{ task_id: a.id, path: 'a.ts', first_version: 3, last_version: 6, deleted: 0 }]);
      upsertTouch(db, { taskId: b.id, path: 'a.ts', firstVersion: 6, lastVersion: 7 });
      moveTouch(db, a.id, b.id, 'a.ts');
      expect(touchesOf(db, a.id)).toEqual([]);
      expect(touchesOf(db, b.id)).toEqual([{ task_id: b.id, path: 'a.ts', first_version: 3, last_version: 7, deleted: 0 }]);
    });
  });
});

describe('request repo', () => {
  it('returns the open request instead of a duplicate (SV-05 / I10)', async () => {
    await withDb((db) => {
      const a = task(db, 'A');
      const b = task(db, 'B');
      const holder = { holderMember: 'A', holderTask: a.id };
      const r1 = createRequest(db, { requesterMember: 'B', requesterTask: b.id, path: 'x.ts', ...holder, source: 'hook', now: 1 });
      const again = createRequest(db, { requesterMember: 'B', requesterTask: b.id, path: 'x.ts', ...holder, source: 'sync', now: 2 });
      expect(r1.created).toBe(true);
      expect(again).toMatchObject({ created: false, request: { id: r1.request.id } });
      expect(r1.request).toMatchObject({ id: 'R-1', status: 'terbuka', source: 'hook' });
      expect(findOpenRequest(db, b.id, 'x.ts')?.id).toBe('R-1');
      setRequestStatus(db, 'R-1', 'diputuskan', { outcome: 'antre', decidedAt: 5 });
      expect(getRequest(db, 'R-1')).toMatchObject({ status: 'diputuskan', outcome: 'antre', decided_at: 5 });
      expect(findOpenRequest(db, b.id, 'x.ts')).toBeNull();
      const r2 = createRequest(db, { requesterMember: 'B', requesterTask: b.id, path: 'x.ts', ...holder, source: 'mcp', now: 6 });
      expect(r2).toMatchObject({ created: true, request: { id: 'R-2' } });
      expect(listRequests(db, ['terbuka']).map((r) => r.id)).toEqual(['R-2']);
    });
  });
});

describe('proposal, review, block and notification repos', () => {
  it('decides a proposal only while it is menunggu (I7) and expires older reviews', async () => {
    await withDb((db) => {
      const a = task(db, 'A');
      const p1 = insertProposal(db, { kind: 'review', payload: '{}', reason: 'r', refId: a.id, createdBy: 'C', now: 1 });
      const p2 = insertProposal(db, { kind: 'review', payload: '{}', reason: 'r', refId: a.id, createdBy: 'C', now: 2 });
      expect([p1.id, p2.id]).toEqual(['P-1', 'P-2']);
      expect(expirePendingReviews(db, a.id, p2.id)).toEqual(['P-1']);
      expect(decideProposal(db, p1.id, 'disetujui', 'mc', 3)).toBe(false);
      expect(decideProposal(db, p2.id, 'disetujui', 'mc', 3, 'ok')).toBe(true);
      expect(getProposal(db, p2.id)).toMatchObject({ status: 'disetujui', decided_by: 'mc', decided_at: 3, decision_note: 'ok' });
      expect(listProposals(db, 'kedaluwarsa').map((p) => p.id)).toEqual(['P-1']);
      expect(insertReview(db, { taskId: a.id, proposalId: p2.id, verdict: 'setujui', notes: '', commitSha: null, now: 4 }).id).toBe('RV-1');
    });
  });

  it('keeps the last block per member and notifications after a cursor', async () => {
    await withDb((db) => {
      const a = task(db, 'A');
      insertBlock(db, { memberId: 'B', taskId: null, path: 'x.ts', holderMember: 'A', holderTask: a.id, via: 'hook', requestId: null, now: 1 });
      insertBlock(db, { memberId: 'B', taskId: null, path: 'y.ts', holderMember: 'A', holderTask: a.id, via: 'sync', requestId: null, now: 2 });
      expect(lastBlockFor(db, 'B')).toMatchObject({ path: 'y.ts', via: 'sync' });
      expect(lastBlockFor(db, 'A')).toBeNull();
      insertNotification(db, { memberId: 'B', kind: 'lock', message: 'one', ref: null, eventId: 5, now: 1 });
      insertNotification(db, { memberId: 'B', kind: 'pm_note', message: 'two', ref: 'T-1', eventId: 9, now: 2 });
      insertNotification(db, { memberId: 'A', kind: 'pm_note', message: 'other', ref: null, eventId: 10, now: 3 });
      expect(notificationsFor(db, 'B', 5).map((n) => n.message)).toEqual(['two']);
    });
  });
});
