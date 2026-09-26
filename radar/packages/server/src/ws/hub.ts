// WebSocket bookkeeping on top of the Hibernation API (fase 03 step 11). Everything that must survive hibernation
// lives in the socket attachment; the constructor runs again on every wake, so no socket state is kept in fields.
import type { Principal, RadarEvent, WsClientKind, WsMessage } from '@radar/common';
import type { UnitOfWork } from '../services/uow';

export type Attachment =
  | { state: 'pending'; helloDeadline: number }
  | { state: 'ready'; client: WsClientKind; principal: Principal; lastHeartbeat: number }
  /** A newer sync socket of the same member took over; this one is closing and must not report offline. */
  | { state: 'replaced'; client: WsClientKind; principal: Principal }
  /** Closed by the server or already handled by the close callback; ignored everywhere. */
  | { state: 'closed' };

export type ReadyAttachment = Extract<Attachment, { state: 'ready' }>;

function isAttachment(v: unknown): v is Attachment {
  if (typeof v !== 'object' || v === null) return false;
  const s = (v as { state?: unknown }).state;
  return s === 'pending' || s === 'ready' || s === 'replaced' || s === 'closed';
}

export class Hub {
  constructor(private readonly ctx: DurableObjectState) {}

  attachment(ws: WebSocket): Attachment | null {
    const a: unknown = ws.deserializeAttachment();
    return isAttachment(a) ? a : null;
  }

  setAttachment(ws: WebSocket, a: Attachment): void {
    ws.serializeAttachment(a);
  }

  /** Ready sockets, optionally only of the given client kinds. */
  ready(clients?: readonly WsClientKind[]): { ws: WebSocket; att: ReadyAttachment }[] {
    const out: { ws: WebSocket; att: ReadyAttachment }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const att = this.attachment(ws);
      if (att?.state === 'ready' && (!clients || clients.includes(att.client))) out.push({ ws, att });
    }
    return out;
  }

  pending(): { ws: WebSocket; helloDeadline: number }[] {
    const out: { ws: WebSocket; helloDeadline: number }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const att = this.attachment(ws);
      if (att?.state === 'pending') out.push({ ws, helloDeadline: att.helloDeadline });
    }
    return out;
  }

  /**
   * Sends one message. When the send fails the socket is closed with 1011, so the client reconnects and gets a
   * fresh snapshot/state instead of drifting silently; its close handler does the presence cleanup.
   */
  send(ws: WebSocket, msg: WsMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch (err) {
      const att = this.attachment(ws);
      console.error(`radar: ws send failed (${msg.t} to ${att?.state === 'ready' ? att.client : (att?.state ?? 'unknown')}):`, err instanceof Error ? err.message : String(err));
      this.close(ws, 1011, 'send failed');
    }
  }

  close(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed: nothing to do.
    }
  }

  /** Events go to Mission Control and app clients (R3 §3, §3.9); sync clients get file messages instead. */
  broadcastEvents(events: readonly RadarEvent[]): void {
    if (events.length === 0) return;
    const targets = this.ready(['mc', 'app']);
    for (const ev of events) for (const { ws } of targets) this.send(ws, { t: 'event', d: ev });
  }

  flush(uow: UnitOfWork): void {
    this.broadcastEvents(uow.events);
    if (uow.toSync.length === 0) return;
    const syncs = this.ready(['sync']);
    for (const m of uow.toSync) for (const { ws } of syncs) if (ws !== m.except) this.send(ws, m.msg);
  }

  closeAll(code: number, reason: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      this.setAttachment(ws, { state: 'closed' });
      this.close(ws, code, reason);
    }
  }
}
