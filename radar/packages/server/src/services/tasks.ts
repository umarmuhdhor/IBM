// Tasks seen by coders and Mission Control (R3 §2.4, §2.5, §2.9, §2.19). Every mutation runs in the caller's
// `db.tx` with a LockCtx; status changes go through `setStatus` (R4 §2 table).
import type { TaskItem, TaskStatus } from '@radar/common';
import { allocationsOf, headOf } from '../db/repo/allocation';
import { getLock, setTaskLocksState } from '../db/repo/lock';
import { getMember, setActiveTask } from '../db/repo/member';
import { openRequestsOfTask, setRequestStatus } from '../db/repo/request';
import { getTask, listTasks, setSubmitSummary, type TaskRow } from '../db/repo/task';
import { touchesOf } from '../db/repo/touch';
import type { Db } from '../db/sql';
import { RadarError } from '../http/errors';
import { expirePendingDecisions } from '../db/repo/proposal';
import { appendEvent } from './events';
import { lockChanged, releaseTaskLocks, setStatus, type LockCtx } from './locks';

const OPEN: readonly TaskStatus[] = ['terbuka', 'dikerjakan', 'review'];

export function taskOr404(db: Db, id: string): TaskRow {
  const task = getTask(db, id);
  if (!task) throw new RadarError(404, 'NOT_FOUND', `Task ${id} tidak ada.`);
  return task;
}

/** R3 §2.4 file list of a task: every allocation, with its lock state and what it waits for. */
export function taskFiles(db: Db, taskId: string): TaskItem['files'] {
  return allocationsOf(db, taskId).map((a) => {
    const lock = getLock(db, a.path);
    const own = lock?.task_id === taskId ? lock.state : null;
    const waitingFor = a.queue_pos > 0 ? (lock?.task_id ?? headOf(db, a.path)?.task_id ?? null) : null;
    return { path: a.path, lock: own, queuePos: a.queue_pos, ...(waitingFor ? { waitingFor } : {}) };
  });
}

export function toTaskItem(db: Db, t: TaskRow): TaskItem {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    ownerId: t.owner_id,
    status: t.status,
    adhoc: t.adhoc === 1,
    baseCommit: t.base_commit,
    editCount: t.edit_count,
    files: taskFiles(db, t.id),
  };
}

/** `GET /v1/tasks?owner=&status=open|all` (default: the caller's open tasks). */
export function listTaskItems(db: Db, owner: string, status: 'open' | 'all'): TaskItem[] {
  return listTasks(db)
    .filter((t) => t.owner_id === owner && (status === 'all' || OPEN.includes(t.status)))
    .map((t) => toTaskItem(db, t));
}

/** `POST /v1/tasks/:id/activate`: only the owner, only a `terbuka`/`dikerjakan` task. */
export function activateTask(db: Db, memberId: string, taskId: string): string {
  const task = taskOr404(db, taskId);
  if (task.owner_id !== memberId) throw new RadarError(403, 'FORBIDDEN', `Task ${task.id} bukan milikmu.`);
  if (task.status !== 'terbuka' && task.status !== 'dikerjakan') {
    throw new RadarError(409, 'CONFLICT', `Task ${task.id} berstatus ${task.status}; hanya task terbuka/dikerjakan yang bisa diaktifkan.`);
  }
  setActiveTask(db, memberId, task.id);
  return task.id;
}

/**
 * `POST /v1/tasks/:id/submit` (R3 §2.9): owner only, the task must be `dikerjakan` (or `terbuka` with edits) and
 * must have changed at least one file. Every lock of the task goes to `review` and stays with the task.
 */
export function submitTask(ctx: LockCtx, memberId: string, taskId: string, summary: string): { files: string[] } {
  const task = taskOr404(ctx.db, taskId);
  if (task.owner_id !== memberId) throw new RadarError(403, 'FORBIDDEN', `Task ${task.id} bukan milikmu.`);
  if (task.status !== 'dikerjakan' && task.status !== 'terbuka') {
    throw new RadarError(409, 'CONFLICT', `Task ${task.id} berstatus ${task.status}; hanya task yang sedang dikerjakan yang bisa di-submit.`);
  }
  const files = touchesOf(ctx.db, task.id).map((t) => t.path);
  if (files.length === 0) throw new RadarError(409, 'CONFLICT', `Task ${task.id} belum mengubah file apa pun.`);
  for (const path of setTaskLocksState(ctx.db, task.id, 'review', ctx.now)) {
    appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: memberId, type: 'lock.review', payload: { path, taskId: task.id } });
    lockChanged(ctx, path);
  }
  setSubmitSummary(ctx.db, task.id, summary, ctx.now);
  appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: memberId, type: 'task.submitted', payload: { taskId: task.id, summary, files } });
  setStatus(ctx, task, 'review', memberId);
  return { files };
}

/** Ends a task for good (`selesai` or `batal`): locks and allocations go (I9), its open requests are closed. */
export function closeTask(ctx: LockCtx, task: TaskRow, to: 'selesai' | 'batal', by: string): void {
  setStatus(ctx, task, to, by);
  releaseTaskLocks(ctx, task.id);
  for (const r of openRequestsOfTask(ctx.db, task.id)) {
    setRequestStatus(ctx.db, r.id, 'batal', { decidedAt: ctx.now });
    for (const id of expirePendingDecisions(ctx.db, r.id)) {
      appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: 'server', type: 'proposal.decided', payload: { proposalId: id, kind: 'decision', status: 'kedaluwarsa', by: 'server', note: `${task.id} ${to}` } });
    }
  }
  if (getMember(ctx.db, task.owner_id)?.active_task_id === task.id) setActiveTask(ctx.db, task.owner_id, null);
}

/** `POST /v1/tasks/:id/cancel` (mc): `terbuka`/`draf`/`dikerjakan` → `batal`; 409 for `review`/`selesai`/`batal`. */
export function cancelTask(ctx: LockCtx, taskId: string): void {
  const task = taskOr404(ctx.db, taskId);
  if (task.status !== 'terbuka' && task.status !== 'draf' && task.status !== 'dikerjakan') {
    throw new RadarError(409, 'CONFLICT', `Task ${task.id} berstatus ${task.status} dan tidak bisa dibatalkan.`);
  }
  closeTask(ctx, task, 'batal', 'mc');
}
