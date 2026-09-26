// `notification` rows (R2 §2): messages for one member, read by the brief after an event cursor.
import type { NotificationKind } from '@radar/common';
import type { Db } from '../sql';

export interface NotificationRow {
  [k: string]: string | number | null;
  id: number;
  member_id: string;
  kind: NotificationKind;
  message: string;
  ref: string | null;
  event_id: number;
  created_at: number;
}

export function insertNotification(
  db: Db,
  n: { memberId: string; kind: NotificationKind; message: string; ref: string | null; eventId: number; now: number },
): NotificationRow {
  const row = db.one<NotificationRow>(
    'INSERT INTO notification (member_id, kind, message, ref, event_id, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    n.memberId,
    n.kind,
    n.message,
    n.ref,
    n.eventId,
    n.now,
  );
  if (!row) throw new Error('notification insert returned no row');
  return row;
}

/** Notifications for `memberId` created by events after `sinceEventId`, oldest first. */
export function notificationsFor(db: Db, memberId: string, sinceEventId: number): NotificationRow[] {
  return db.all<NotificationRow>('SELECT * FROM notification WHERE member_id = ? AND event_id > ? ORDER BY event_id, id', memberId, sinceEventId);
}
