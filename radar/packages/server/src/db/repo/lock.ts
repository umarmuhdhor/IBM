// `lock` rows (R2 §2, R4 §1): one row per path = one writer (I1). No row means the path is free (bebas).
import type { LineRange, LockState } from '@radar/common';
import type { Db } from '../sql';

export interface LockRow {
  [k: string]: string | number | null;
  path: string;
  task_id: string;
  member_id: string;
  state: LockState;
  acquired_at: number;
  updated_at: number;
  /** D-alief-17: locked lines, both NULL = the whole file. */
  start_line: number | null;
  end_line: number | null;
}

/** The lock's line range, or null for a whole-file lock. */
export function rangeOf(l: Pick<LockRow, 'start_line' | 'end_line'>): LineRange | null {
  return l.start_line !== null && l.end_line !== null ? { start: l.start_line, end: l.end_line } : null;
}

export function getLock(db: Db, path: string): LockRow | null {
  return db.one<LockRow>('SELECT * FROM lock WHERE path = ?', path);
}

export function listLocks(db: Db): LockRow[] {
  return db.all<LockRow>('SELECT * FROM lock ORDER BY path');
}

export function locksOfTask(db: Db, taskId: string): LockRow[] {
  return db.all<LockRow>('SELECT * FROM lock WHERE task_id = ? ORDER BY path', taskId);
}

export function insertLock(db: Db, l: { path: string; taskId: string; memberId: string; state: LockState; now: number; range?: LineRange | null }): void {
  db.run(
    'INSERT INTO lock (path, task_id, member_id, state, acquired_at, updated_at, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    l.path,
    l.taskId,
    l.memberId,
    l.state,
    l.now,
    l.now,
    l.range?.start ?? null,
    l.range?.end ?? null,
  );
}

export function setLockRange(db: Db, path: string, range: LineRange, now: number): void {
  db.run('UPDATE lock SET start_line = ?, end_line = ?, updated_at = ? WHERE path = ?', range.start, range.end, now, path);
}

/** Hands the lock to another task (decision `pindahkan`); `acquired_at` restarts and the new holder gets the whole file. */
export function updateLock(db: Db, path: string, to: { taskId: string; memberId: string; state: LockState }, now: number): void {
  db.run(
    'UPDATE lock SET task_id = ?, member_id = ?, state = ?, acquired_at = ?, updated_at = ?, start_line = NULL, end_line = NULL WHERE path = ?',
    to.taskId,
    to.memberId,
    to.state,
    now,
    now,
    path,
  );
}

export function setLockState(db: Db, path: string, state: LockState, now: number): void {
  db.run('UPDATE lock SET state = ?, updated_at = ? WHERE path = ?', state, now, path);
}

/** Sets every lock of `taskId` to `state`; returns the paths that changed. */
export function setTaskLocksState(db: Db, taskId: string, state: LockState, now: number): string[] {
  return db
    .all<{ path: string }>('UPDATE lock SET state = ?, updated_at = ? WHERE task_id = ? AND state != ? RETURNING path', state, now, taskId, state)
    .map((r) => r.path)
    .sort();
}

export function deleteLock(db: Db, path: string): void {
  db.run('DELETE FROM lock WHERE path = ?', path);
}
