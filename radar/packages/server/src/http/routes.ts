// Hono app that runs inside the Durable Object (fase 03 step 9). The Worker forwards everything except /healthz.
import { AdminJoinCodeReq, BobActivityReq, encodeInvite, JoinReq, normalizeJoinCode, WS_HELLO_TIMEOUT_MS, type JoinRes } from '@radar/common';
import { Hono, type MiddlewareHandler } from 'hono';
import { createJoinCode, registerAdminRoutes } from '../admin';
import { sha256Hex } from '../crypto';
import type { WorkspaceDeps } from '../deps';
import { memberForJoinCode } from '../db/repo/join-code';
import { getMember } from '../db/repo/member';
import { insertMetric } from '../db/repo/metric';
import { appendEvent } from '../services/events';
import { exportEvents } from '../services/export';
import { truncateActivityText } from '../services/activity';
import { rotateToken } from '../services/join';
import { buildState } from '../services/state';
import { principalFromHeader, requireMember, requireRole } from './auth';
import { errorJson, parseWith, RadarError, readJson, toErrorResponse } from './errors';
import { ExportQuery } from './query';
import { registerFileRoutes } from './routes/files';
import { registerLockRoutes } from './routes/locks';
import { registerProposalRoutes } from './routes/proposals';
import { registerRequestRoutes } from './routes/requests';
import { registerTaskRoutes } from './routes/tasks';
import { registerTeamRoutes } from './routes/team';

export function createApp(deps: WorkspaceDeps): Hono {
  const app = new Hono();
  app.onError((err) => toErrorResponse(err));
  app.notFound(() => errorJson(404, 'NOT_FOUND', 'Endpoint tidak ada.'));

  app.get('/ws', async (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return errorJson(426, 'BAD_REQUEST', 'Butuh header Upgrade: websocket.');
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // No tags: client kind and member are only known after `hello` (fase 03 step 11).
    deps.ctx.acceptWebSocket(server);
    deps.hub.setAttachment(server, { state: 'pending', helloDeadline: deps.now() + WS_HELLO_TIMEOUT_MS });
    await deps.scheduler.reschedule();
    return new Response(null, { status: 101, webSocket: client });
  });

  app.get('/v1/state', (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['coder', 'pm', 'mc']);
    return c.json(buildState(deps.db, deps.workspaceId()));
  });

  app.get('/v1/events/export', (c) => {
    if (deps.env.PUBLIC_EXPORT !== 'true') requireRole(deps.db, c.req.header('authorization'), ['coder', 'pm', 'mc']);
    const q = parseWith(ExportQuery, c.req.query());
    return c.json(exportEvents(deps.db, deps.workspaceId(), q, deps.now()));
  });

  // IN-03 (D-alief-09): no token yet, the short code is the credential. Limited per client IP so codes cannot be
  // guessed quickly (40 bits); a wrong or expired code is 404 without saying which.
  app.post('/v1/join', async (c) => {
    const retry = deps.rateLimiter.hit(`join:${c.req.header('cf-connecting-ip') ?? 'unknown'}`, deps.now());
    if (retry > 0) {
      const res = errorJson(429, 'RATE_LIMITED', `Terlalu banyak percobaan. Coba lagi dalam ${retry} detik.`);
      res.headers.set('retry-after', String(retry));
      return res;
    }
    const code = normalizeJoinCode(parseWith(JoinReq, await readJson(c.req.raw)).code);
    const memberId = code === null ? null : memberForJoinCode(deps.db, sha256Hex(code), deps.now());
    const member = memberId === null ? null : getMember(deps.db, memberId);
    if (!member) throw new RadarError(404, 'NOT_FOUND', 'Kode gabung salah atau sudah kedaluwarsa. Minta kode baru ke pemilik workspace.');
    const workspace = deps.workspaceId();
    const token = rotateToken(deps, member.id);
    const res: JoinRes = { workspace, member: member.id, role: member.role, invite: encodeInvite({ server: new URL(c.req.url).origin, workspace, member: member.id, token }) };
    return c.json(res);
  });

  // IN-03: Mission Control (the owner's app) makes join codes for teammates without the admin secret.
  app.post('/v1/join-codes', async (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['mc']);
    return c.json(createJoinCode(deps, parseWith(AdminJoinCodeReq, await readJson(c.req.raw))), 201);
  });

  app.post('/v1/bob/activity', async (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder', 'pm']);
    const req = parseWith(BobActivityReq, truncateActivityText(await readJson(c.req.raw)));
    const now = deps.now();
    const { accepted, droppedToReport } = deps.limiter.hit(member.memberId, now);
    if (droppedToReport > 0) {
      deps.transact(() => insertMetric(deps.db, { ts: now, name: 'activity_dropped', value: droppedToReport, tags: { memberId: member.memberId } }));
    }
    if (!accepted) return c.body(null, 204);
    // memberId comes from the token, never from the body; clientTs is not stored (R3 §2.24).
    const payload = { memberId: member.memberId, ...req };
    delete payload.clientTs;
    deps.transact((uow) => appendEvent(deps.db, uow, { ts: now, actor: member.memberId, type: 'bob.activity', payload }));
    return c.body(null, 204);
  });

  // Rate limit before the routes (fase 12 step 9): mc decisions, proposal writes and AI edit marks. Reads are not
  // limited. One middleware with an explicit path test: Hono's `/x/*` also matches `/x`, so two patterns would count
  // twice. Keyed by principal; a request without a valid token is not counted and gets its 401 from the route.
  const limitedPath = /^\/v1\/(proposals(\/.*)?|locks\/revoke|tasks\/[^/]+\/cancel|ai-edits)$/;
  const limited: MiddlewareHandler = async (c, next) => {
    if (c.req.method !== 'POST' || !limitedPath.test(c.req.path)) return next();
    const p = principalFromHeader(deps.db, c.req.header('authorization'));
    if (!p) return next();
    const retry = deps.rateLimiter.hit(p.kind === 'mc' ? 'mc' : `member:${p.memberId}`, deps.now());
    if (retry === 0) return next();
    const res = errorJson(429, 'RATE_LIMITED', `Terlalu banyak permintaan. Coba lagi dalam ${retry} detik.`);
    res.headers.set('retry-after', String(retry));
    return res;
  };
  app.use('/v1/*', limited);

  registerLockRoutes(app, deps);
  registerFileRoutes(app, deps);
  registerTaskRoutes(app, deps);
  registerRequestRoutes(app, deps);
  registerProposalRoutes(app, deps);
  registerTeamRoutes(app, deps);
  registerAdminRoutes(app, deps);
  return app;
}
