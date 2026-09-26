// `request` rows (R2 §2): a coder asking for a file someone else holds. One active request per task + path
// (SV-05 / I10), enforced by the unique index `request_open_dedup`.
import type { DecisionOption, RequestSource, RequestStatus } from '@radar/common';
import type { Db } from '../sql';
import { nextCounter } from './counter';

export interface RequestRow {
  [k: string]: string | number | null;
  id: string;
  seq: number;
  requester_member: string;
  requester_task: string;
  path: string;
  holder_member: string;
  holder_task: string;
  reason: string;
  source: RequestSource;
  status: RequestStatus;
  proposal_id: string | null;
  outcome: DecisionOption | null;
  created_at: number;
  decided_at: number | null;
}

export interface NewRequest {
  requesterMember: string;
  requesterTask: string;
  path: string;
  holderMember: string;
  holderTask: string;
  reason?: string;
  source: RequestSource;
  now: number;
}

export function getRequest(db: Db, id: string): RequestRow | null {
  return db.one<RequestRow>('SELECT * FROM request WHERE id = ?', id);
}

export function findOpenRequest(db: Db, requesterTask: string, path: string): RequestRow | null {
  return db.one<RequestRow>("SELECT * FROM request WHERE requester_task = ? AND path = ? AND status IN ('terbuka','diusulkan')", requesterTask, path);
}

/**
 * Returns the open request for this task + path, or creates `R-<seq>`. The dedup index is the last line of
 * defence: a unique violation also returns the existing row. Call inside `db.tx`.
 */
export function createRequest(db: Db, r: NewRequest): { request: RequestRow; created: boolean } {
  const open = findOpenRequest(db, r.requesterTask, r.path);
  if (open) return { request: open, created: false };
  const seq = nextCounter(db, 'request');
  try {
    const row = db.one<RequestRow>(
      `INSERT INTO request (id, seq, requester_member, requester_task, path, holder_member, holder_task, reason, source, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'terbuka', ?) RETURNING *`,
      `R-${seq}`,
      seq,
      r.requesterMember,
      r.requesterTask,
      r.path,
      r.holderMember,
      r.holderTask,
      r.reason ?? '',
      r.source,
      r.now,
    );
    if (!row) throw new Error('request insert returned no row');
    return { request: row, created: true };
  } catch (err) {
    const existing = /UNIQUE/i.test(String(err)) ? findOpenRequest(db, r.requesterTask, r.path) : null;
    if (existing) return { request: existing, created: false };
    throw err;
  }
}

export function setRequestStatus(
  db: Db,
  id: string,
  status: RequestStatus,
  extra: { proposalId?: string | null; outcome?: DecisionOption | null; decidedAt?: number | null } = {},
): void {
  db.run(
    `UPDATE request SET status = ?,
       proposal_id = CASE WHEN ? THEN ? ELSE proposal_id END,
       outcome = CASE WHEN ? THEN ? ELSE outcome END,
       decided_at = CASE WHEN ? THEN ? ELSE decided_at END
     WHERE id = ?`,
    status,
    extra.proposalId !== undefined ? 1 : 0,
    extra.proposalId ?? null,
    extra.outcome !== undefined ? 1 : 0,
    extra.outcome ?? null,
    extra.decidedAt !== undefined ? 1 : 0,
    extra.decidedAt ?? null,
    id,
  );
}

/** Requests with one of `statuses` (all when omitted), oldest first. */
export function listRequests(db: Db, statuses?: readonly RequestStatus[]): RequestRow[] {
  if (!statuses || statuses.length === 0) return db.all<RequestRow>('SELECT * FROM request ORDER BY seq');
  return db.all<RequestRow>(`SELECT * FROM request WHERE status IN (${statuses.map(() => '?').join(',')}) ORDER BY seq`, ...statuses);
}

/** Active requests of a task (cancel closes them). */
export function openRequestsOfTask(db: Db, taskId: string): RequestRow[] {
  return db.all<RequestRow>("SELECT * FROM request WHERE requester_task = ? AND status IN ('terbuka','diusulkan') ORDER BY seq", taskId);
}
