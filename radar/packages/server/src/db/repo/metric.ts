// `metric` rows (R4 §9).
import type { Db } from '../sql';

export function insertMetric(db: Db, m: { ts: number; name: string; value: number; tags?: Record<string, unknown> }): void {
  db.run('INSERT INTO metric (ts, name, value, tags) VALUES (?, ?, ?, ?)', m.ts, m.name, m.value, m.tags ? JSON.stringify(m.tags) : null);
}
