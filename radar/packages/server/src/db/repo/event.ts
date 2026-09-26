// `event` rows (R2 §2): the append-only log behind the brief cursor, Mission Control and the replay.
import type { Db } from '../sql';

export interface EventRow {
  [k: string]: string | number | null;
  id: number;
  ts: number;
  actor: string;
  type: string;
  payload: string;
}

export function insertEvent(db: Db, e: { ts: number; actor: string; type: string; payload: string }): EventRow {
  const row = db.one<EventRow>('INSERT INTO event (ts, actor, type, payload) VALUES (?, ?, ?, ?) RETURNING *', e.ts, e.actor, e.type, e.payload);
  if (!row) throw new Error('event insert returned no row');
  return row;
}

export function eventRange(db: Db, from: number, to: number, limit: number): EventRow[] {
  return db.all<EventRow>('SELECT * FROM event WHERE id >= ? AND id <= ? ORDER BY id LIMIT ?', from, to, limit);
}

/** Last `n` events, oldest first. */
export function recentEvents(db: Db, n: number): EventRow[] {
  return db.all<EventRow>('SELECT * FROM (SELECT * FROM event ORDER BY id DESC LIMIT ?) ORDER BY id', n);
}

export function lastEventId(db: Db): number {
  return db.one<{ id: number | null }>('SELECT max(id) AS id FROM event')?.id ?? 0;
}

/** Events after `sinceId` with one of `types`, the newest `limit` of them, oldest first (brief, R4 §8). */
export function eventsAfter(db: Db, sinceId: number, types: readonly string[], limit: number): EventRow[] {
  if (types.length === 0) return [];
  return db.all<EventRow>(
    `SELECT * FROM (SELECT * FROM event WHERE id > ? AND type IN (${types.map(() => '?').join(',')}) ORDER BY id DESC LIMIT ?) ORDER BY id`,
    sinceId,
    ...types,
    limit,
  );
}
