// Lock engine (R4 §3–5, fase 05). Every exported function runs inside the caller's `db.tx` and records its
// events in the unit of work, so a throw rolls back rows, events and WebSocket messages together.
import {
  COMMIT_CLAIM_TTL_MS,
  createIgnoreMatcherFromText,
  type BlockVia,
  type LockCheckResult,
  type LockHolder,
  type TaskStatus,
} from '@radar/common';
import { queueOf } from '../db/repo/allocation';
import { getFile } from '../db/repo/file';
import { getLock, setTaskLocksState, type LockRow } from '../db/repo/lock';
import { getMember, setActiveTask, type MemberRow } from '../db/repo/member';
import { expirePendingReviews } from '../db/repo/proposal';
import { firstOpenTask, getTask, insertTask, latestWorkingTask, setTaskStatus, type TaskRow } from '../db/repo/task';
import type { Db } from '../db/sql';
import { appendEvent } from './events';
import type { UnitOfWork } from './uow';

/** What every lock function needs: the transaction's db, its outbox, and one clock reading. */
export interface LockCtx {
  db: Db;
  uow: UnitOfWork;
  now: number;
}

/** `checkWrite` answer for one path (R3 §2.2 `LockCheckResult` without the path). */
export type CheckWriteResult = Omit<LockCheckResult, 'path'> & { taskId: string | null };

const ACTIVE: readonly TaskStatus[] = ['terbuka', 'dikerjakan', 'review'];

/** R4 §6.3 point 5: a claim older than COMMIT_CLAIM_TTL_MS counts as free. */
export function commitClaimActive(task: Pick<TaskRow, 'commit_started_at'> | null, now: number): boolean {
  return task?.commit_started_at != null && now - task.commit_started_at < COMMIT_CLAIM_TTL_MS;
}

/** R5 §6 defaults plus the workspace's own `.gitignore` as the server holds it. */
export function isIgnoredPath(db: Db, path: string): boolean {
  const gi = getFile(db, '.gitignore');
  const text = gi && !gi.deleted ? (gi.content ?? '') : '';
  return createIgnoreMatcherFromText(text).ignores(path);
}

export function requireMember(db: Db, id: string): MemberRow {
  const m = getMember(db, id);
  if (!m) throw new Error(`member ${id} does not exist`);
  return m;
}

export function requireTask(db: Db, id: string): TaskRow {
  const t = getTask(db, id);
  if (!t) throw new Error(`task ${id} does not exist`);
  return t;
}

/** Holder details shown to a blocked member (R3 §2.2). */
export function holderOf(ctx: LockCtx, lock: LockRow): LockHolder {
  const member = getMember(ctx.db, lock.member_id);
  const task = getTask(ctx.db, lock.task_id);
  return {
    memberId: lock.member_id,
    memberName: member?.name ?? lock.member_id,
    taskId: lock.task_id,
    taskTitle: task?.title ?? lock.task_id,
    state: lock.state,
    sinceMs: Math.max(0, ctx.now - lock.acquired_at),
  };
}

/** Changes a task's status and records `task.status` (no-op when it already has `to`). */
export function setStatus(ctx: LockCtx, task: TaskRow, to: TaskStatus, by: string): void {
  if (task.status === to) return;
  setTaskStatus(ctx.db, task.id, to, ctx.now);
  appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: by, type: 'task.status', payload: { taskId: task.id, from: task.status, to, by } });
}

/**
 * R4 §4: the member's current task. 1) `active_task_id` if still theirs and active, 2) latest `dikerjakan`,
 * 3) oldest `terbuka`, 4) a new ad-hoc task (`dikerjakan`). The result is stored as `active_task_id`.
 */
export function resolveActiveTask(ctx: LockCtx, memberId: string): TaskRow {
  const member = requireMember(ctx.db, memberId);
  let task: TaskRow | null = null;
  if (member.active_task_id) {
    const t = getTask(ctx.db, member.active_task_id);
    if (t && t.owner_id === memberId && ACTIVE.includes(t.status)) task = t;
  }
  task ??= latestWorkingTask(ctx.db, memberId) ?? firstOpenTask(ctx.db, memberId);
  if (!task) {
    task = insertTask(ctx.db, { title: `Ad-hoc ${member.name}`, ownerId: memberId, status: 'dikerjakan', adhoc: true, now: ctx.now });
    appendEvent(ctx.db, ctx.uow, {
      ts: ctx.now,
      actor: 'server',
      type: 'task.created',
      payload: { taskId: task.id, title: task.title, ownerId: memberId, status: 'dikerjakan', files: [], queuedFiles: [], adhoc: true },
    });
  }
  setActiveTask(ctx.db, memberId, task.id);
  return task;
}

/** R4 §2 `terbuka → dikerjakan` on the first edit, and the task becomes the owner's active task. */
export function markTaskWorking(ctx: LockCtx, taskId: string): void {
  const task = requireTask(ctx.db, taskId);
  if (task.status === 'terbuka') setStatus(ctx, task, 'dikerjakan', task.owner_id);
  setActiveTask(ctx.db, task.owner_id, task.id);
}

/**
 * R4 §2 `review → dikerjakan` (owner edited during review, or review `kembalikan`): every lock of the task goes
 * back to `dipegang` and pending review proposals for it expire.
 */
export function returnTaskToWorking(ctx: LockCtx, taskId: string, by: string): void {
  const task = requireTask(ctx.db, taskId);
  for (const path of setTaskLocksState(ctx.db, task.id, 'dipegang', ctx.now)) lockChanged(ctx, path);
  expirePendingReviews(ctx.db, task.id);
  if (task.status === 'review') setStatus(ctx, task, 'dikerjakan', by);
}

/** Queues a `lock.changed` WebSocket message for every sync client (sent after commit). */
export function lockChanged(ctx: LockCtx, path: string): void {
  const lock = getLock(ctx.db, path);
  ctx.uow.toSync.push({
    msg: {
      t: 'lock.changed',
      d: {
        path,
        state: lock?.state ?? 'bebas',
        taskId: lock?.task_id ?? null,
        memberId: lock?.member_id ?? null,
        queue: queueOf(ctx.db, path).map((e) => e.task_id),
      },
    },
    except: null,
  });
}

/**
 * R4 §3 `checkWrite(member, path, via)`: the decision table behind `POST /v1/locks/check` (via `hook`) and
 * every WebSocket `file.update` (via `sync`).
 */
export function checkWrite(ctx: LockCtx, memberId: string, path: string, via: BlockVia): CheckWriteResult {
  // BOB SLICE A2 (fase 05): implemented in IBM Bob IDE from plan/ref/R4-mesin-kunci.md §3.
  void ctx;
  void memberId;
  void path;
  void via;
  throw new Error('checkWrite is not implemented yet (BOB SLICE A2)');
}
