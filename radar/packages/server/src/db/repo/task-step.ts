// `task_step` rows — steps checklist for a task (R schema v7).
import type { TaskStepSchema } from '@radar/common';
import type { Db } from '../sql';

interface TaskStepRow {
  [k: string]: string | number | null;
  task_id: string;
  idx: number;
  text: string;
  done: number;
  done_at: number | null;
}

/** Insert the initial step list for a newly created task. No-op when `texts` is empty. */
export function insertSteps(db: Db, taskId: string, texts: string[]): void {
  for (let i = 0; i < texts.length; i++) {
    db.run('INSERT INTO task_step (task_id, idx, text, done) VALUES (?, ?, ?, 0)', taskId, i, texts[i]!);
  }
}

/** All steps for a task in index order. */
export function listSteps(db: Db, taskId: string): TaskStepSchema[] {
  return db
    .all<TaskStepRow>('SELECT idx, text, done FROM task_step WHERE task_id = ? ORDER BY idx', taskId)
    .map((r) => ({ text: r.text, done: r.done === 1 }));
}

/**
 * Mark step `idx` done/undone. Returns `false` when the row does not exist (unknown index),
 * `true` on success.
 */
export function setStepDone(db: Db, taskId: string, idx: number, done: boolean, now: number): boolean {
  const row = db.one<{ idx: number }>('SELECT idx FROM task_step WHERE task_id = ? AND idx = ?', taskId, idx);
  if (!row) return false;
  db.run(
    'UPDATE task_step SET done = ?, done_at = ? WHERE task_id = ? AND idx = ?',
    done ? 1 : 0,
    done ? now : null,
    taskId,
    idx,
  );
  return true;
}
