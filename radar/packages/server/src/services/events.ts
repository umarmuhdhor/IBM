// Event log (R3 §5, fase 03 step 5). Every state change appends its event in the same transaction.
import { parseRadarEvent, RadarEventSchema, type RadarEvent, type RadarEventOf, type RadarEventType } from '@radar/common';
import { insertEvent, type EventRow } from '../db/repo/event';
import type { Db } from '../db/sql';
import type { UnitOfWork } from './uow';

export interface NewEvent<T extends RadarEventType> {
  ts: number;
  actor: string;
  type: T;
  payload: RadarEventOf<T>['payload'];
}

/** Validates, inserts and queues the event for broadcast after commit. Throws outside `db.tx`. */
export function appendEvent<T extends RadarEventType>(db: Db, uow: UnitOfWork, e: NewEvent<T>): RadarEventOf<T> {
  if (!db.inTx) throw new Error(`appendEvent(${e.type}) called outside a transaction`);
  const checked = RadarEventSchema.safeParse({ id: 0, ts: e.ts, actor: e.actor, type: e.type, payload: e.payload });
  if (!checked.success) throw new Error(`invalid ${e.type} event: ${checked.error.issues[0]?.message ?? 'schema mismatch'}`);
  const row = insertEvent(db, { ts: e.ts, actor: e.actor, type: e.type, payload: JSON.stringify(checked.data.payload) });
  const ev = { ...checked.data, id: row.id } as RadarEventOf<T>;
  uow.events.push(ev);
  return ev;
}

/** Stored row → event. Rows that no longer match the schema are logged and skipped (forward compatible). */
export function rowToEvent(row: EventRow): RadarEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    console.error(`radar: event ${row.id} has an unreadable payload; skipped`);
    return null;
  }
  const ev = parseRadarEvent({ id: row.id, ts: row.ts, actor: row.actor, type: row.type, payload });
  if (!ev) console.error(`radar: event ${row.id} (${row.type}) does not match the schema; skipped`);
  return ev;
}

export function rowsToEvents(rows: EventRow[]): RadarEvent[] {
  const out: RadarEvent[] = [];
  for (const r of rows) {
    const ev = rowToEvent(r);
    if (ev) out.push(ev);
  }
  return out;
}
