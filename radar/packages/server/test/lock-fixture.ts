// Fixture for lock-engine tests (fase 05): a seeded workspace (A, B coder; C pm) and a synchronous callback that
// runs inside one transaction of the real Durable Object SQLite, with a LockCtx and small builders.
import type { LockState, TaskStatus } from '@radar/common';
import { runInDurableObject } from 'cloudflare:test';
import { insertAllocation, nextPos } from '../src/db/repo/allocation';
import { insertLock } from '../src/db/repo/lock';
import { insertTask, setCommitClaim, type TaskRow } from '../src/db/repo/task';
import type { Db } from '../src/db/sql';
import type { LockCtx } from '../src/services/locks';
import { UnitOfWork } from '../src/services/uow';
import type { WorkspaceDO } from '../src/workspace-do';
import { freshWorkspace, seedTestWorkspace } from './helpers';

export const NOW = 1_000_000;

export interface LockFixture {
  ctx: LockCtx;
  db: Db;
  /** Event types appended so far in this transaction, in order. */
  events(): string[];
  /** Task owned by `owner` (default status `terbuka`). */
  task(owner: string, status?: TaskStatus, title?: string): TaskRow;
  /** Lock row for `path` plus the matching queue_pos 0 allocation (I4). */
  lock(path: string, task: TaskRow, state: LockState): void;
  /** Queued allocation (next free position) without a lock. */
  queue(path: string, task: TaskRow): number;
  /** Starts a commit claim on `task` `ageMs` ago. */
  claim(task: TaskRow, ageMs?: number): void;
  count(sql: string, ...args: (string | number)[]): number;
}

/** Runs `fn` in a fresh workspace, inside one transaction. Files are seeded first (`.gitignore` counts). */
export async function withLocks<T>(fn: (f: LockFixture) => T, files: { path: string; content: string }[] = []): Promise<T> {
  const { stub } = freshWorkspace();
  await seedTestWorkspace(stub, files);
  return runInDurableObject(stub, (instance: WorkspaceDO) =>
    instance.db.tx(() => {
      const db = instance.db;
      const uow = new UnitOfWork();
      const ctx: LockCtx = { db, uow, now: NOW };
      const f: LockFixture = {
        ctx,
        db,
        events: () => uow.events.map((e) => e.type),
        task: (owner, status = 'terbuka', title) => insertTask(db, { title: title ?? `Task ${owner}`, ownerId: owner, status, now: NOW - 1000 }),
        lock: (path, task, state) => {
          insertAllocation(db, { taskId: task.id, path, pos: 0, source: 'plan', now: NOW - 1000 });
          insertLock(db, { path, taskId: task.id, memberId: task.owner_id, state, now: NOW - 1000 });
        },
        queue: (path, task) => {
          const pos = nextPos(db, path);
          insertAllocation(db, { taskId: task.id, path, pos, source: 'decision', now: NOW - 500 });
          return pos;
        },
        claim: (task, ageMs = 1000) => setCommitClaim(db, task.id, NOW - ageMs),
        count: (sql, ...args) => db.one<{ n: number }>(sql, ...args)?.n ?? 0,
      };
      return fn(f);
    }),
  );
}
