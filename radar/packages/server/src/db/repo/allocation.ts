// `allocation` rows (R2 §2, R4 §5): which tasks want a path, in queue order. `queue_pos` 0 is the task that holds
// or reserved the lock; the rest wait. Every writer keeps positions gap-free (I5) via `renumberQueue`.
import type { AllocationSource } from '@radar/common';
import type { Db } from '../sql';

export interface AllocationRow {
  [k: string]: string | number | null;
  task_id: string;
  path: string;
  queue_pos: number;
  source: AllocationSource;
  created_at: number;
}

export interface QueueEntry extends AllocationRow {
  owner_id: string;
}

export function getAllocation(db: Db, taskId: string, path: string): AllocationRow | null {
  return db.one<AllocationRow>('SELECT * FROM allocation WHERE task_id = ? AND path = ?', taskId, path);
}

/** The queue of `path`, head first, with each task's owner. */
export function queueOf(db: Db, path: string): QueueEntry[] {
  return db.all<QueueEntry>(
    'SELECT a.*, t.owner_id FROM allocation a JOIN task t ON t.id = a.task_id WHERE a.path = ? ORDER BY a.queue_pos, a.created_at, a.task_id',
    path,
  );
}

export function headOf(db: Db, path: string): QueueEntry | null {
  return queueOf(db, path)[0] ?? null;
}

/** Position a new entry for `path` gets: 0 when nothing is allocated. */
export function nextPos(db: Db, path: string): number {
  return db.one<{ n: number }>('SELECT count(*) AS n FROM allocation WHERE path = ?', path)?.n ?? 0;
}

export function insertAllocation(db: Db, a: { taskId: string; path: string; pos: number; source: AllocationSource; now: number }): void {
  db.run('INSERT INTO allocation (task_id, path, queue_pos, source, created_at) VALUES (?, ?, ?, ?, ?)', a.taskId, a.path, a.pos, a.source, a.now);
}

export function moveAllocation(db: Db, taskId: string, path: string, pos: number): void {
  db.run('UPDATE allocation SET queue_pos = ? WHERE task_id = ? AND path = ?', pos, taskId, path);
}

export function deleteAllocation(db: Db, taskId: string, path: string): void {
  db.run('DELETE FROM allocation WHERE task_id = ? AND path = ?', taskId, path);
}

/** Rewrites positions of `path` to 0, 1, 2, … keeping the current order (I5). */
export function renumberQueue(db: Db, path: string): void {
  queueOf(db, path).forEach((e, i) => {
    if (e.queue_pos !== i) moveAllocation(db, e.task_id, path, i);
  });
}

/** Puts `taskId` at position 0 of `path` (creating its allocation if needed); the others keep their order behind it. */
export function setFront(db: Db, path: string, taskId: string, source: AllocationSource, now: number): void {
  const rest = queueOf(db, path).filter((e) => e.task_id !== taskId);
  if (!getAllocation(db, taskId, path)) insertAllocation(db, { taskId, path, pos: 0, source, now });
  else moveAllocation(db, taskId, path, 0);
  rest.forEach((e, i) => moveAllocation(db, e.task_id, path, i + 1));
}

export function pathsOf(db: Db, taskId: string): string[] {
  return db.all<{ path: string }>('SELECT path FROM allocation WHERE task_id = ? ORDER BY path', taskId).map((r) => r.path);
}

export function allocationsOf(db: Db, taskId: string): AllocationRow[] {
  return db.all<AllocationRow>('SELECT * FROM allocation WHERE task_id = ? ORDER BY path', taskId);
}

export function listAllocations(db: Db): AllocationRow[] {
  return db.all<AllocationRow>('SELECT * FROM allocation ORDER BY path, queue_pos');
}
