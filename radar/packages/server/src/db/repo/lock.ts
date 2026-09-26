// `lock` rows (R2 §2, R4 §1): one row per path = one writer (I1). No row means the path is free (bebas).
import type { LockState } from '@radar/common';
import type { Db } from '../sql';

export interface LockRow {
  [k: string]: string | number | null;
  path: string;
  task_id: string;
  member_id: string;
  state: LockState;
  acquired_at: number;
  updated_at: number;
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

export function insertLock(db: Db, l: { path: string; taskId: string; memberId: string; state: LockState; now: number }): void {
  db.run(
    'INSERT INTO lock (path, task_id, member_id, state, acquired_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    l.path,
    l.taskId,
    l.memberId,
    l.state,
    l.now,
    l.now,
  );
}

/** Hands the lock to another task (decision `pindahkan`); `acquired_at` restarts. */
export function updateLock(db: Db, path: string, to: { taskId: string; memberId: string; state: LockState }, now: number): void {
  db.run('UPDATE lock SET task_id = ?, member_id = ?, state = ?, acquired_at = ?, updated_at = ? WHERE path = ?', to.taskId, to.memberId, to.state, now, now, path);
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
