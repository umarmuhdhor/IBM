// WebSocket protocol (R3 §3, fase 03 step 11). Every handler is synchronous after parsing, so one message is
// fully applied before the DO takes the next.
import { WS_CLOSE_UNAUTHORIZED, WsMessageSchema, type WsMessage, type WsMessageOf } from '@radar/common';
import type { WorkspaceDeps } from '../deps';
import { setOffline, setOnline } from '../db/repo/member';
import { principalForToken } from '../http/auth';
import { appendEvent } from '../services/events';
import { applyDelete, applyUpdate } from '../services/files';
import { buildSnapshot, buildState } from '../services/state';
import { endStaleEpisode } from '../services/stale';
import type { ReadyAttachment } from './hub';

/** Close code for a sync socket replaced by a newer one of the same member (R3 §3). */
export const WS_CLOSE_REPLACED = 4000;
/** Close code used when the workspace is reset. */
export const WS_CLOSE_RESET = 1012;

const decoder = new TextDecoder();

function parseFrame(raw: string | ArrayBuffer): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(typeof raw === 'string' ? raw : decoder.decode(raw)) };
  } catch {
    return { ok: false };
  }
}

export function handleMessage(deps: WorkspaceDeps, ws: WebSocket, raw: string | ArrayBuffer): void {
  const { hub } = deps;
  const att = hub.attachment(ws);
  if (!att || att.state === 'replaced' || att.state === 'closed') return;
  const frame = parseFrame(raw);

  if (att.state === 'pending') {
    const parsed = frame.ok ? WsMessageSchema.safeParse(frame.value) : null;
    if (!parsed?.success || parsed.data.t !== 'hello' || deps.now() > att.helloDeadline) {
      hub.setAttachment(ws, { state: 'closed' });
      hub.close(ws, WS_CLOSE_UNAUTHORIZED, 'hello required');
      return;
    }
    handleHello(deps, ws, parsed.data);
    return;
  }

  if (!frame.ok) {
    hub.send(ws, { t: 'error', d: { code: 'BAD_REQUEST', message: 'Pesan bukan JSON yang valid.' } });
    return;
  }
  const parsed = WsMessageSchema.safeParse(frame.value);
  if (!parsed.success) {
    hub.send(ws, { t: 'error', d: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Pesan tidak sesuai kontrak.' } });
    return;
  }
  const msg = parsed.data;
  switch (msg.t) {
    case 'file.update':
      handleFileUpdate(deps, ws, att, msg);
      return;
    case 'file.delete':
      handleFileDelete(deps, ws, att, msg);
      return;
    case 'file.applied':
      handleFileApplied(deps, att, msg);
      return;
    case 'heartbeat':
      hub.setAttachment(ws, { ...att, lastHeartbeat: deps.now() });
      if (att.client === 'sync' && att.principal.kind === 'member') endStaleEpisode(deps, att.principal.memberId);
      return;
    case 'hello':
      hub.send(ws, { t: 'error', d: { code: 'BAD_REQUEST', message: 'hello sudah diterima.' } });
      return;
    default:
      // term.* (terminal relay, P1) is not handled yet.
      hub.send(ws, { t: 'error', d: { code: 'BAD_REQUEST', message: `Pesan ${msg.t} belum didukung server.` } });
  }
}

function handleHello(deps: WorkspaceDeps, ws: WebSocket, msg: WsMessageOf<'hello'>): void {
  const { hub, db } = deps;
  const { token, client, knownVersions } = msg.d;
  const principal = principalForToken(db, token);
  // sync needs a member token, mc needs the mc token, app accepts either (R3 §3.9).
  const allowed = principal !== null && (client === 'sync' ? principal.kind === 'member' : client === 'mc' ? principal.kind === 'mc' : true);
  if (!principal || !allowed) {
    hub.send(ws, { t: 'error', d: { code: 'UNAUTHORIZED', message: 'Token atau jenis klien tidak sah.' } });
    hub.setAttachment(ws, { state: 'closed' });
    hub.close(ws, WS_CLOSE_UNAUTHORIZED, 'unauthorized');
    return;
  }
  const now = deps.now();

  if (client === 'sync' && principal.kind === 'member') {
    const previous = hub.ready(['sync']).filter(({ att }) => att.principal.kind === 'member' && att.principal.memberId === principal.memberId);
    for (const p of previous) {
      hub.setAttachment(p.ws, { state: 'replaced', client: 'sync', principal: p.att.principal });
      hub.close(p.ws, WS_CLOSE_REPLACED, 'replaced by a newer connection');
    }
    hub.setAttachment(ws, { state: 'ready', client, principal, lastHeartbeat: now });
    deps.transact((uow) => {
      setOnline(db, principal.memberId, true);
      const type = previous.length > 0 ? 'member.reconnected' : 'member.online';
      appendEvent(db, uow, { ts: now, actor: principal.memberId, type, payload: { memberId: principal.memberId } });
    });
    hub.send(ws, { t: 'welcome', d: { principal, serverTime: now, workspace: deps.workspaceId() } });
    hub.send(ws, { t: 'snapshot', d: buildSnapshot(db, knownVersions) });
    return;
  }

  hub.setAttachment(ws, { state: 'ready', client, principal, lastHeartbeat: now });
  hub.send(ws, { t: 'welcome', d: { principal, serverTime: now, workspace: deps.workspaceId() } });
  hub.send(ws, { t: 'state', d: buildState(db, deps.workspaceId()) });
}

function handleFileUpdate(deps: WorkspaceDeps, ws: WebSocket, att: ReadyAttachment, msg: WsMessageOf<'file.update'>): void {
  const { hub, db } = deps;
  const p = att.principal;
  if (att.client !== 'sync' || p.kind !== 'member') {
    hub.send(ws, { t: 'error', d: { code: 'FORBIDDEN', message: 'Hanya klien sync yang boleh mengirim file.update.' } });
    return;
  }
  const now = deps.now();
  const r = deps.transact((uow) => {
    const res = applyUpdate(db, uow, { now, authorizeWrite: deps.authorizeWrite }, p, msg.d);
    if (res.ok && res.changed) {
      uow.toSync.push({
        except: ws,
        msg: {
          t: 'file.changed',
          d: { path: res.path, version: res.version, content: res.content, hash: res.hash, deleted: false, by: p.memberId, taskId: res.taskId, serverTs: now },
        },
      });
    }
    return res;
  });
  const reply: WsMessage = r.ok
    ? { t: 'file.ack', ...(msg.id ? { id: msg.id } : {}), d: { ...(msg.id ? { id: msg.id } : {}), path: r.path, version: r.version, hash: r.hash } }
    : {
        t: 'file.rejected',
        ...(msg.id ? { id: msg.id } : {}),
        d: { ...(msg.id ? { id: msg.id } : {}), path: r.path, reason: r.reason, holder: r.holder, server: r.server },
      };
  hub.send(ws, reply);
}

function handleFileDelete(deps: WorkspaceDeps, ws: WebSocket, att: ReadyAttachment, msg: WsMessageOf<'file.delete'>): void {
  const { hub, db } = deps;
  const p = att.principal;
  if (att.client !== 'sync' || p.kind !== 'member') {
    hub.send(ws, { t: 'error', d: { code: 'FORBIDDEN', message: 'Hanya klien sync yang boleh mengirim file.delete.' } });
    return;
  }
  const now = deps.now();
  const r = deps.transact((uow) => {
    const res = applyDelete(db, uow, { now, authorizeWrite: deps.authorizeWrite }, p, msg.d);
    if (res.ok && res.changed) {
      uow.toSync.push({
        except: ws,
        msg: { t: 'file.changed', d: { path: res.path, version: res.version, content: null, hash: null, deleted: true, by: p.memberId, taskId: res.taskId, serverTs: now } },
      });
    }
    return res;
  });
  const id = msg.id ? { id: msg.id } : {};
  // The ack of a delete carries an empty hash: there is no content.
  const reply: WsMessage = r.ok
    ? { t: 'file.ack', ...id, d: { ...id, path: r.path, version: r.version, hash: '' } }
    : { t: 'file.rejected', ...id, d: { ...id, path: r.path, reason: r.reason, holder: r.holder, server: r.server } };
  hub.send(ws, reply);
}

function handleFileApplied(deps: WorkspaceDeps, att: ReadyAttachment, msg: WsMessageOf<'file.applied'>): void {
  const p = att.principal;
  if (att.client !== 'sync' || p.kind !== 'member') return;
  const now = deps.now();
  deps.transact((uow) =>
    appendEvent(deps.db, uow, {
      ts: now,
      actor: p.memberId,
      type: 'sync.applied',
      payload: { path: msg.d.path, version: msg.d.version, memberId: p.memberId, latencyMs: msg.d.appliedTs - msg.d.serverTs },
    }),
  );
}

/** Close/error of a socket. Only the last sync socket of a member reports it offline (R4 §7). Idempotent. */
export function handleClose(deps: WorkspaceDeps, ws: WebSocket): void {
  const { hub, db } = deps;
  const att = hub.attachment(ws);
  if (att?.state !== 'ready' || att.client !== 'sync' || att.principal.kind !== 'member') return;
  const memberId = att.principal.memberId;
  // Mark this socket done first, so a second close/error callback for it is a no-op.
  hub.setAttachment(ws, { state: 'closed' });
  const stillConnected = hub.ready(['sync']).some(({ ws: other, att: a }) => other !== ws && a.principal.kind === 'member' && a.principal.memberId === memberId);
  if (stillConnected) return;
  const now = deps.now();
  deps.transact((uow) => {
    setOffline(db, memberId, att.lastHeartbeat);
    appendEvent(db, uow, { ts: now, actor: memberId, type: 'member.offline', payload: { memberId } });
  });
}

/** Earliest hello deadline among sockets still waiting for `hello`. */
export function helloDeadline(deps: WorkspaceDeps): number | null {
  let next: number | null = null;
  for (const p of deps.hub.pending()) if (next === null || p.helloDeadline < next) next = p.helloDeadline;
  return next;
}

/** Alarm body: closes sockets whose hello deadline passed. Safe to run more than once. */
export function expireHellos(deps: WorkspaceDeps): void {
  const now = deps.now();
  for (const p of deps.hub.pending()) {
    if (p.helloDeadline > now) continue;
    deps.hub.setAttachment(p.ws, { state: 'closed' });
    deps.hub.close(p.ws, WS_CLOSE_UNAUTHORIZED, 'hello timeout');
  }
}
