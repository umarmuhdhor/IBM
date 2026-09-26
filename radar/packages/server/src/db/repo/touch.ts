// `task_touch` rows (R2 §2): files a task really changed, the base for its commit and diff.
import type { Db } from '../sql';

export interface TouchRow {
  [k: string]: string | number | null;
  task_id: string;
  path: string;
  first_version: number;
  last_version: number;
  deleted: number;
}

/** First edit stores `firstVersion` (the version before it); later edits only move `last_version`. */
export function upsertTouch(db: Db, t: { taskId: string; path: string; firstVersion: number; lastVersion: number; deleted?: boolean }): void {
  db.run(
    `INSERT INTO task_touch (task_id, path, first_version, last_version, deleted) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(task_id, path) DO UPDATE SET last_version = excluded.last_version, deleted = excluded.deleted`,
    t.taskId,
    t.path,
    t.firstVersion,
    t.lastVersion,
    t.deleted ? 1 : 0,
  );
}

export function touchesOf(db: Db, taskId: string): TouchRow[] {
  return db.all<TouchRow>('SELECT * FROM task_touch WHERE task_id = ? ORDER BY path', taskId);
}

export function getTouch(db: Db, taskId: string, path: string): TouchRow | null {
  return db.one<TouchRow>('SELECT * FROM task_touch WHERE task_id = ? AND path = ?', taskId, path);
}

/** Moves the touch of `path` from one task to another (decision `pindahkan`, R4 §5); the earliest first_version wins. */
export function moveTouch(db: Db, fromTaskId: string, toTaskId: string, path: string): void {
  const from = getTouch(db, fromTaskId, path);
  if (!from) return;
  const to = getTouch(db, toTaskId, path);
  db.run('DELETE FROM task_touch WHERE task_id = ? AND path = ?', fromTaskId, path);
  if (!to) {
    db.run(
      'INSERT INTO task_touch (task_id, path, first_version, last_version, deleted) VALUES (?, ?, ?, ?, ?)',
      toTaskId,
      path,
      from.first_version,
      from.last_version,
      from.deleted,
    );
    return;
  }
  const newer = to.last_version >= from.last_version ? to : from;
  db.run(
    'UPDATE task_touch SET first_version = ?, last_version = ?, deleted = ? WHERE task_id = ? AND path = ?',
    Math.min(from.first_version, to.first_version),
    newer.last_version,
    newer.deleted,
    toTaskId,
    path,
  );
}
