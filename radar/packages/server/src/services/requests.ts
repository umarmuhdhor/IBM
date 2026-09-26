// Blocks and file requests (R3 §2.6, §2.7, §2.11).
import type { BlockLastRes, RequestFileRes, RequestItem, RequestStatus } from '@radar/common';
import { queueOf } from '../db/repo/allocation';
import { lastBlockFor } from '../db/repo/block';
import { getFile } from '../db/repo/file';
import { getLock, locksOfTask } from '../db/repo/lock';
import { getMember } from '../db/repo/member';
import { createRequest, getRequest, listRequests } from '../db/repo/request';
import { getTask } from '../db/repo/task';
import { getTouch } from '../db/repo/touch';
import type { Db } from '../db/sql';
import { appendEvent } from './events';
import { holderOf, requireMember, resolveActiveTask, type LockCtx } from './locks';

/**
 * R3 §2.6 `suggestion`: who has the file, where the request stands, and which files of the caller's active task
 * are still writable (own lock, not in review), untouched ones first.
 */
function suggestionFor(db: Db, memberId: string, holderTask: string | null, requestId: string | null): string {
  const parts: string[] = [];
  if (holderTask) parts.push(`File ini milik ${holderTask}.`);
  if (requestId) parts.push(`Permintaanmu ${requestId} sudah masuk antrean PM.`);
  const active = getMember(db, memberId)?.active_task_id ?? null;
  const writable = active
    ? locksOfTask(db, active)
        .filter((l) => l.state !== 'review')
        .map((l) => l.path)
        .sort((a, b) => Number(getTouch(db, active, a) !== null) - Number(getTouch(db, active, b) !== null) || a.localeCompare(b))
    : [];
  if (active && writable.length > 0) parts.push(`Lanjutkan file lain di task ${active}: ${writable.slice(0, 3).join(', ')}.`);
  else if (active) parts.push(`Task ${active} tidak punya file lain yang bisa ditulis; tunggu keputusan PM.`);
  else parts.push('Tunggu keputusan PM atau panggil radar my_tasks.');
  return parts.join(' ');
}

/** `GET /v1/blocks/last` (MCP `why_blocked`). Read-only: never creates a task or a request. */
export function lastBlock(db: Db, memberId: string, now: number): BlockLastRes {
  const b = lastBlockFor(db, memberId);
  if (!b) return { block: null };
  const lock = getLock(db, b.path);
  const request = b.request_id ? getRequest(db, b.request_id) : null;
  return {
    block: {
      path: b.path,
      ts: b.ts,
      via: b.via,
      holder: lock ? holderOf({ db, now }, lock) : null,
      requestId: b.request_id,
      requestStatus: request?.status ?? null,
      queue: queueOf(db, b.path).map((e) => ({ taskId: e.task_id, memberId: e.owner_id })),
      suggestion: suggestionFor(db, memberId, lock?.task_id ?? null, b.request_id),
    },
  };
}

/**
 * `POST /v1/requests` (MCP `request_file`). A free file or one the caller already holds needs no request; an
 * existing active request for the same task + path is returned with `duplicate: true` (SV-05).
 */
export function requestFile(ctx: LockCtx, memberId: string, path: string, reason: string): { status: 200 | 201; body: RequestFileRes } {
  requireMember(ctx.db, memberId);
  const lock = getLock(ctx.db, path);
  if (!lock) return { status: 200, body: { requestId: null, status: 'bebas', message: 'File bebas, langsung edit saja.' } };
  if (lock.member_id === memberId) {
    return { status: 200, body: { requestId: null, status: 'bebas', message: `File ini sudah dikunci untuk task kamu (${lock.task_id}).` } };
  }
  const reqTask = resolveActiveTask(ctx, memberId);
  const { request, created } = createRequest(ctx.db, {
    requesterMember: memberId,
    requesterTask: reqTask.id,
    path,
    holderMember: lock.member_id,
    holderTask: lock.task_id,
    reason,
    source: 'mcp',
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
        source: 'mcp',
      },
    });
  }
  return { status: created ? 201 : 200, body: { requestId: request.id, status: request.status, duplicate: !created } };
}

/** `GET /v1/requests?status=terbuka|diusulkan|all` (default: both active statuses), with both sides' task details. */
export function listRequestItems(db: Db, status: 'terbuka' | 'diusulkan' | 'all' | undefined): RequestItem[] {
  const statuses: RequestStatus[] | undefined = status === 'all' ? undefined : status ? [status] : ['terbuka', 'diusulkan'];
  return listRequests(db, statuses).map((r) => {
    const reqTask = getTask(db, r.requester_task);
    const lock = getLock(db, r.path);
    const holderTask = lock ? getTask(db, lock.task_id) : null;
    return {
      id: r.id,
      path: r.path,
      status: r.status,
      source: r.source,
      reason: r.reason,
      requester: {
        memberId: r.requester_member,
        taskId: r.requester_task,
        taskTitle: reqTask?.title ?? '',
        taskDescription: reqTask?.description ?? '',
      },
      holder:
        lock && holderTask
          ? {
              memberId: lock.member_id,
              taskId: lock.task_id,
              taskTitle: holderTask.title,
              taskDescription: holderTask.description,
              state: lock.state,
              editCount: holderTask.edit_count,
            }
          : null,
      fileVersion: getFile(db, r.path)?.version ?? 0,
      createdAt: r.created_at,
    };
  });
}
