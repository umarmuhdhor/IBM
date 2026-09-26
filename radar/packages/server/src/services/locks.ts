// Lock engine (R4 §3–5, fase 05). Every exported function runs inside the caller's `db.tx` and records its
// events in the unit of work, so a throw rolls back rows, events and WebSocket messages together.
import {
  COMMIT_CLAIM_TTL_MS,
  createIgnoreMatcherFromText,
  type BlockVia,
  type LockCheckResult,
  type LockHolder,
  type AllocationSource,
  type TaskStatus,
} from '@radar/common';
import { deleteAllocation, getAllocation, headOf, insertAllocation, nextPos, pathsOf, queueOf, renumberQueue, setFront, type QueueEntry } from '../db/repo/allocation';
import { insertBlock } from '../db/repo/block';
import { getFile } from '../db/repo/file';
import { deleteLock, getLock, insertLock, setLockState, setTaskLocksState, updateLock, type LockRow } from '../db/repo/lock';
import { getMember, setActiveTask, type MemberRow } from '../db/repo/member';
import { expirePendingReviews } from '../db/repo/proposal';
import { createRequest } from '../db/repo/request';
import { firstOpenTask, getTask, insertTask, latestWorkingTask, setTaskStatus, type TaskRow } from '../db/repo/task';
import { moveTouch } from '../db/repo/touch';
import type { Db } from '../db/sql';
import { RadarError } from '../http/errors';
import { appendEvent } from './events';
import { addNotification } from './notifications';
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

/** R4 §2: the only task status changes the server makes. Anything else is a 409. */
const TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  draf: ['terbuka', 'batal'],
  terbuka: ['dikerjakan', 'review', 'batal'],
  dikerjakan: ['review', 'batal'],
  review: ['dikerjakan', 'selesai'],
  selesai: [],
  batal: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * `transitionTask` of fase 05 step 4: changes a task's status after checking R4 §2 and records `task.status`.
 * No-op when the task already has `to`; an illegal change throws 409 CONFLICT.
 */
export function setStatus(ctx: LockCtx, task: TaskRow, to: TaskStatus, by: string): void {
  if (task.status === to) return;
  if (!canTransition(task.status, to)) {
    throw new RadarError(409, 'CONFLICT', `Task ${task.id} tidak bisa pindah dari ${task.status} ke ${to}.`);
  }
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
      // Promote the queue head (lock.transferred, cause queue), then block the requesting member.
      advanceQueue(ctx, path, null);
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

// ---- R4 §5–6.1: queues, release, transfer, revoke --------------------------------------------------------------

/**
 * R4 §6.1 `enqueue`: gives `task` the next queue position on `path`. Position 0 on a free path reserves it
 * (`lock.reserved`); otherwise the task waits (`lock.queued`). A task already allocated keeps its place.
 */
export function enqueue(ctx: LockCtx, path: string, task: TaskRow, source: AllocationSource): number {
  const existing = getAllocation(ctx.db, task.id, path);
  if (existing) return existing.queue_pos;
  const lock = getLock(ctx.db, path);
  // I4 repair: a lock without its position-0 allocation (must not happen) gets it back before we queue.
  if (lock && !getAllocation(ctx.db, lock.task_id, path)) setFront(ctx.db, path, lock.task_id, 'auto', ctx.now);
  const pos = nextPos(ctx.db, path);
  insertAllocation(ctx.db, { taskId: task.id, path, pos, source, now: ctx.now });
  if (pos === 0 && !lock) {
    insertLock(ctx.db, { path, taskId: task.id, memberId: task.owner_id, state: 'dipesan', now: ctx.now });
    appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: 'server', type: 'lock.reserved', payload: { path, taskId: task.id, memberId: task.owner_id, source } });
  } else {
    appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: 'server', type: 'lock.queued', payload: { path, taskId: task.id, memberId: task.owner_id, pos } });
  }
  lockChanged(ctx, path);
  return pos;
}

/**
 * R4 §5 `advanceQueue`: the queue head of a path without a lock gets it as `dipesan` (`lock.transferred`) and a
 * "Giliranmu" notification. An empty queue leaves the path free. Returns the new holder, if any.
 */
export function advanceQueue(ctx: LockCtx, path: string, fromTaskId: string | null): QueueEntry | null {
  const head = headOf(ctx.db, path);
  if (!head) {
    lockChanged(ctx, path);
    return null;
  }
  insertLock(ctx.db, { path, taskId: head.task_id, memberId: head.owner_id, state: 'dipesan', now: ctx.now });
  appendEvent(ctx.db, ctx.uow, {
    ts: ctx.now,
    actor: 'server',
    type: 'lock.transferred',
    payload: { path, fromTaskId, toTaskId: head.task_id, toMemberId: head.owner_id, cause: 'queue' },
  });
  lockChanged(ctx, path);
  addNotification(ctx, { memberId: head.owner_id, kind: 'lock', message: `Giliranmu: ${path} kini dipesan untuk ${head.task_id}.`, ref: head.task_id });
  return head;
}

/**
 * R4 §5 `releaseTaskLocks`: drops every allocation of a finished or cancelled task (I9). Paths it held go to the
 * next task in their queue; paths it only waited for just lose one queue entry.
 */
export function releaseTaskLocks(ctx: LockCtx, taskId: string): void {
  for (const path of pathsOf(ctx.db, taskId)) {
    deleteAllocation(ctx.db, taskId, path);
    renumberQueue(ctx.db, path);
    if (getLock(ctx.db, path)?.task_id === taskId) {
      deleteLock(ctx.db, path);
      appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: 'server', type: 'lock.released', payload: { path, taskId } });
      advanceQueue(ctx, path, taskId);
    } else {
      lockChanged(ctx, path);
    }
  }
}

/**
 * R4 §5 `transferNow` (decision `pindahkan`): `toTask` takes the lock as `dipesan` right away and the old holder
 * queues right behind it. Uncommitted edits of the old holder on this path move with it (task_touch).
 */
export function transferNow(ctx: LockCtx, path: string, toTask: TaskRow): void {
  const lock = getLock(ctx.db, path);
  if (!lock) {
    enqueue(ctx, path, toTask, 'decision');
    return;
  }
  if (lock.task_id === toTask.id) return;
  const fromTask = requireTask(ctx.db, lock.task_id);
  setFront(ctx.db, path, toTask.id, 'decision', ctx.now);
  updateLock(ctx.db, path, { taskId: toTask.id, memberId: toTask.owner_id, state: 'dipesan' }, ctx.now);
  moveTouch(ctx.db, fromTask.id, toTask.id, path);
  appendEvent(ctx.db, ctx.uow, {
    ts: ctx.now,
    actor: 'server',
    type: 'lock.transferred',
    payload: { path, fromTaskId: fromTask.id, toTaskId: toTask.id, toMemberId: toTask.owner_id, cause: 'decision' },
  });
  lockChanged(ctx, path);
  const toName = getMember(ctx.db, toTask.owner_id)?.name ?? toTask.owner_id;
  addNotification(ctx, {
    memberId: fromTask.owner_id,
    kind: 'lock',
    message: `${path} dipindahkan ke ${toName} (${toTask.id}) oleh keputusan PM. Kamu antre berikutnya.`,
    ref: fromTask.id,
  });
}

/** R4 §5 revoke (SV-09): frees `path` from its holder, who loses the allocation, and advances the queue. */
export function revoke(ctx: LockCtx, path: string, reason: string, by: string): QueueEntry | null {
  const lock = getLock(ctx.db, path);
  if (!lock) throw new RadarError(404, 'NOT_FOUND', `${path} tidak sedang dikunci.`);
  deleteLock(ctx.db, path);
  deleteAllocation(ctx.db, lock.task_id, path);
  renumberQueue(ctx.db, path);
  appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: by, type: 'lock.revoked', payload: { path, taskId: lock.task_id, memberId: lock.member_id, reason } });
  addNotification(ctx, { memberId: lock.member_id, kind: 'lock', message: `Kunci ${path} dicabut PM: ${reason}`, ref: lock.task_id });
  return advanceQueue(ctx, path, lock.task_id);
}

