// `task` rows (R2 §2, R4 §2). Status changes go through services/tasks.ts `transitionTask`; this module only
// reads and writes rows.
import type { TaskStatus } from '@radar/common';
import type { Db } from '../sql';
import { nextCounter } from './counter';

export interface TaskRow {
  [k: string]: string | number | null;
  id: string;
  seq: number;
  title: string;
  description: string;
  owner_id: string;
  status: TaskStatus;
  adhoc: number;
  base_commit: string | null;
  plan_proposal_id: string | null;
  parent_task_id: string | null;
  submit_summary: string | null;
  commit_sha: string | null;
  commit_started_at: number | null;
  edit_count: number;
  created_at: number;
  updated_at: number;
}

export interface NewTask {
  title: string;
  description?: string;
  ownerId: string;
  status: TaskStatus;
  adhoc?: boolean;
  baseCommit?: string | null;
  planProposalId?: string | null;
  parentTaskId?: string | null;
  now: number;
}

/** Creates `T-<seq>`. Call inside `db.tx`. */
export function insertTask(db: Db, t: NewTask): TaskRow {
  const seq = nextCounter(db, 'task');
  const row = db.one<TaskRow>(
    `INSERT INTO task (id, seq, title, description, owner_id, status, adhoc, base_commit, plan_proposal_id, parent_task_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    `T-${seq}`,
    seq,
    t.title,
    t.description ?? '',
    t.ownerId,
    t.status,
    t.adhoc ? 1 : 0,
    t.baseCommit ?? null,
    t.planProposalId ?? null,
    t.parentTaskId ?? null,
    t.now,
    t.now,
  );
  if (!row) throw new Error('task insert returned no row');
  return row;
}

export function getTask(db: Db, id: string): TaskRow | null {
  return db.one<TaskRow>('SELECT * FROM task WHERE id = ?', id);
}

export function listTasks(db: Db): TaskRow[] {
  return db.all<TaskRow>('SELECT * FROM task ORDER BY seq');
}

/** Owner's `dikerjakan` task with the latest `updated_at` (R4 §4 step 2). */
export function latestWorkingTask(db: Db, ownerId: string): TaskRow | null {
  return db.one<TaskRow>("SELECT * FROM task WHERE owner_id = ? AND status = 'dikerjakan' ORDER BY updated_at DESC, seq DESC LIMIT 1", ownerId);
}

/** Owner's `terbuka` task with the smallest `seq` (R4 §4 step 3). */
export function firstOpenTask(db: Db, ownerId: string): TaskRow | null {
  return db.one<TaskRow>("SELECT * FROM task WHERE owner_id = ? AND status = 'terbuka' ORDER BY seq LIMIT 1", ownerId);
}

export function setTaskStatus(db: Db, id: string, status: TaskStatus, now: number): void {
  db.run('UPDATE task SET status = ?, updated_at = ? WHERE id = ?', status, now, id);
}

export function touchTaskUpdated(db: Db, id: string, now: number): void {
  db.run('UPDATE task SET updated_at = ? WHERE id = ?', now, id);
}

export function bumpEditCount(db: Db, id: string, now: number): void {
  db.run('UPDATE task SET edit_count = edit_count + 1, updated_at = ? WHERE id = ?', now, id);
}

export function setSubmitSummary(db: Db, id: string, summary: string | null, now: number): void {
  db.run('UPDATE task SET submit_summary = ?, updated_at = ? WHERE id = ?', summary, now, id);
}

/** `ts` starts a commit claim (R4 §6.3 Tx1); null clears it. */
export function setCommitClaim(db: Db, id: string, ts: number | null): void {
  db.run('UPDATE task SET commit_started_at = ? WHERE id = ?', ts, id);
}

export function setCommitSha(db: Db, id: string, sha: string, now: number): void {
  db.run('UPDATE task SET commit_sha = ?, commit_started_at = NULL, updated_at = ? WHERE id = ?', sha, now, id);
}

/** Tasks whose commit claim is set (active or expired). */
export function tasksWithCommitClaim(db: Db): TaskRow[] {
  return db.all<TaskRow>('SELECT * FROM task WHERE commit_started_at IS NOT NULL ORDER BY seq');
}
