// Notifications for one member (R3 §2.16, R4 §5–6). The brief reads them by event cursor, so every row points at
// the event that caused it.
import { NOTIFY_MAX_CHARS, type NotificationKind } from '@radar/common';
import { lastEventId } from '../db/repo/event';
import { insertNotification, type NotificationRow } from '../db/repo/notification';
import type { Db } from '../db/sql';
import { appendEvent } from './events';
import type { UnitOfWork } from './uow';

interface Ctx {
  db: Db;
  uow: UnitOfWork;
  now: number;
}

export interface NewNotification {
  memberId: string;
  kind: NotificationKind;
  message: string;
  ref: string | null;
}

const clip = (message: string) => (message.length <= NOTIFY_MAX_CHARS ? message : `${message.slice(0, NOTIFY_MAX_CHARS - 1)}…`);

/** Server-made notification (lock moved, decision, review). Tied to the event appended just before it. */
export function addNotification(ctx: Ctx, n: NewNotification): NotificationRow {
  return insertNotification(ctx.db, { ...n, message: clip(n.message), eventId: lastEventId(ctx.db), now: ctx.now });
}

/**
 * A note someone sends to a member (`POST /v1/notify`, review `setujui_beri_tahu`): the row plus its own
 * `notify.sent` event. The row is written first because the event names its id, then re-pointed at the event.
 */
export function sendNote(ctx: Ctx, n: NewNotification, by: string): NotificationRow {
  const row = insertNotification(ctx.db, { ...n, message: clip(n.message), eventId: 0, now: ctx.now });
  const ev = appendEvent(ctx.db, ctx.uow, {
    ts: ctx.now,
    actor: by,
    type: 'notify.sent',
    payload: { notificationId: row.id, memberId: n.memberId, message: row.message, by },
  });
  ctx.db.run('UPDATE notification SET event_id = ? WHERE id = ?', ev.id, row.id);
  return { ...row, event_id: ev.id };
}
