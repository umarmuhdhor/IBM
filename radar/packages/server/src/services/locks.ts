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
import { headOf, insertAllocation, queueOf } from '../db/repo/allocation';
import { insertBlock } from '../db/repo/block';
import { getFile } from '../db/repo/file';
import { getLock, insertLock, setLockState, setTaskLocksState, type LockRow } from '../db/repo/lock';
import { getMember, setActiveTask, type MemberRow } from '../db/repo/member';
import { expirePendingReviews } from '../db/repo/proposal';
import { createRequest } from '../db/repo/request';
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
 *
 * Decision table (rows 1–12 from R4 §3):
 *  1. ignored path          → allow  'ignored_path'       (no side-effects)
 *  2. member is PM          → block  'pm_readonly'         (no request)
 *  3. file free, no queue   → allow  'grabbed'             (lock dipegang, task → dikerjakan)
 *  4. dipesan by own task   → allow  'own'                 (→ dipegang, task → dikerjakan)
 *  5. dipegang by own task  → allow  'own'                 (no state change)
 *  6. dipegang by own other → allow  'own'                 (active_task switches)
 *  7. review by own task    → allow  'own'                 (task back to dikerjakan, reviews expire)
 *  8. dipesan by other      → block  'reserved_by_other'   (request dedup + block row)
 *  9. dipegang by other     → block  'held_by_other'       (request dedup + block row)
 * 10. review by other       → block  'in_review_by_other'  (request dedup + block row)
 * 11. #9 repeated           → block  'held_by_other'       (1 request, N block rows)
 * 12. commit claim active   → block  'committing'          (no request, applies to owner too)
 */
export function checkWrite(ctx: LockCtx, memberId: string, path: string, via: BlockVia): CheckWriteResult {
  // Row 1: ignored paths are always allowed, no DB work needed.
  if (isIgnoredPath(ctx.db, path)) return { decision: 'allow', reason: 'ignored_path', taskId: null };

  // Row 2: PMs are read-only — block without creating a request.
  const member = requireMember(ctx.db, memberId);
  if (member.role === 'pm') return { decision: 'block', reason: 'pm_readonly', holder: null, taskId: null };

  const lock = getLock(ctx.db, path);

  // Row 12: commit claim active — blocks every member, including the lock owner.
  if (lock !== null) {
    const lockTask = getTask(ctx.db, lock.task_id);
    if (commitClaimActive(lockTask, ctx.now)) {
      return { decision: 'block', reason: 'committing', holder: holderOf(ctx, lock), taskId: null };
    }
  }

  if (lock === null) {
    // Row 3: file is free — but defensively promote a stale queue head if one exists (R4 §3, I4).
    const head = headOf(ctx.db, path);
    if (head !== null && head.owner_id !== memberId) {
      // Promote queue head to dipesan and then block the requesting member.
      insertLock(ctx.db, { path, taskId: head.task_id, memberId: head.owner_id, state: 'dipesan', now: ctx.now });
      lockChanged(ctx, path);
      return blockFor(ctx, memberId, path, via);
    }

    // No queue: auto-grab for the member's active (or new ad-hoc) task.
    const task = resolveActiveTask(ctx, memberId);
    insertAllocation(ctx.db, { taskId: task.id, path, pos: 0, source: 'auto', now: ctx.now });
    insertLock(ctx.db, { path, taskId: task.id, memberId, state: 'dipegang', now: ctx.now });
    markTaskWorking(ctx, task.id);
    appendEvent(ctx.db, ctx.uow, {
      ts: ctx.now,
      actor: memberId,
      type: 'lock.acquired',
      payload: { path, taskId: task.id, memberId, auto: true },
    });
    lockChanged(ctx, path);
    return { decision: 'allow', reason: 'grabbed', taskId: task.id };
  }

  // Lock exists and the member is the lock's owner (same member, any task of theirs).
  if (lock.member_id === memberId) {
    if (lock.state === 'dipesan') {
      // Row 4: reserved by own task — promote to dipegang.
      setLockState(ctx.db, path, 'dipegang', ctx.now);
      appendEvent(ctx.db, ctx.uow, {
        ts: ctx.now,
        actor: memberId,
        type: 'lock.acquired',
        payload: { path, taskId: lock.task_id, memberId, auto: false },
      });
      lockChanged(ctx, path);
    } else if (lock.state === 'review') {
      // Row 7: in review by own task — revert task and all its locks back to dikerjakan/dipegang.
      returnTaskToWorking(ctx, lock.task_id, memberId);
      // returnTaskToWorking calls lockChanged for all paths of the task, including this one.
    }
    // Rows 5–7: mark task working and point active_task at it.
    markTaskWorking(ctx, lock.task_id);
    setActiveTask(ctx.db, memberId, lock.task_id);
    return { decision: 'allow', reason: 'own', taskId: lock.task_id };
  }

  // Rows 8–11: lock is held by someone else.
  return blockFor(ctx, memberId, path, via);
}

/**
 * Records a block row (always) and a request (dedup: one open request per task+path), then returns the
 * BLOCK result. Corresponds to `blockFor(member, path, via)` in R4 §3 pseudocode.
 */
function blockFor(ctx: LockCtx, memberId: string, path: string, via: BlockVia): CheckWriteResult {
  const lock = getLock(ctx.db, path);
  // lock is guaranteed to exist here: either it was just inserted (promote case) or it existed already.
  if (!lock) throw new Error(`blockFor: no lock found for path ${path}`);

  const reqTask = resolveActiveTask(ctx, memberId);

  // One open request per task+path (SV-05 / I10); emit request.created only on first creation.
  const { request, created } = createRequest(ctx.db, {
    requesterMember: memberId,
    requesterTask: reqTask.id,
    path,
    holderMember: lock.member_id,
    holderTask: lock.task_id,
    source: via,
    now: ctx.now,
  });

  if (created) {
    appendEvent(ctx.db, ctx.uow, {
      ts: ctx.now,
      actor: memberId,
      type: 'request.created',
      payload: {
        requestId: request.id,
        path,
        requesterMemberId: memberId,
        requesterTaskId: reqTask.id,
        holderMemberId: lock.member_id,
        holderTaskId: lock.task_id,
        source: via,
      },
    });
  }

  // Always insert a block row (row 11: same request, N block rows).
  insertBlock(ctx.db, {
    memberId,
    taskId: reqTask.id,
    path,
    holderMember: lock.member_id,
    holderTask: lock.task_id,
    via,
    requestId: request.id,
    now: ctx.now,
  });

  appendEvent(ctx.db, ctx.uow, {
    ts: ctx.now,
    actor: memberId,
    type: 'lock.blocked',
    payload: {
      path,
      memberId,
      taskId: reqTask.id,
      holderMemberId: lock.member_id,
      holderTaskId: lock.task_id,
      via,
      requestId: request.id,
    },
  });

  const reason =
    lock.state === 'dipesan' ? 'reserved_by_other' : lock.state === 'review' ? 'in_review_by_other' : 'held_by_other';

  // Compute queue position of the requester's task (null when not yet in the queue).
  const queue = queueOf(ctx.db, path);
  const queueEntry = queue.find((e) => e.task_id === reqTask.id);
  const queuePos = queueEntry?.queue_pos ?? null;

  return {
    decision: 'block',
    reason,
    holder: holderOf(ctx, lock),
    requestId: request.id,
    queuePos,
    taskId: reqTask.id,
  };
}
