// Human-readable id sequences (R2 §1): T-<seq>, R-<seq>, P-<seq>, RV-<seq>.
import type { Db } from '../sql';

export const COUNTERS = ['task', 'request', 'proposal', 'review'] as const;
export type CounterName = (typeof COUNTERS)[number];

export function initCounters(db: Db): void {
  for (const name of COUNTERS) db.run('INSERT INTO counter (name, value) VALUES (?, 0) ON CONFLICT(name) DO NOTHING', name);
}

/** Increments and returns the new value. Call inside `db.tx`. */
export function nextCounter(db: Db, name: CounterName): number {
  const row = db.one<{ value: number }>('UPDATE counter SET value = value + 1 WHERE name = ? RETURNING value', name);
  if (!row) throw new Error(`counter ${name} is missing (workspace not initialised)`);
  return row.value;
}
