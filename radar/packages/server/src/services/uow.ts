// Outbox for one transaction (fase 03 step 5): events and WebSocket messages are collected while `db.tx` runs
// and sent only after it commits. A throw discards the outbox together with the rolled-back writes.
import type { RadarEvent, WsMessage } from '@radar/common';

export interface SyncMessage {
  msg: WsMessage;
  /** Socket that caused the change; it gets an ack instead. */
  except: WebSocket | null;
}

export class UnitOfWork {
  readonly events: RadarEvent[] = [];
  readonly toSync: SyncMessage[] = [];
}
