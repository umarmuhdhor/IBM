// Hono app that runs inside the Durable Object (fase 03 step 9). The Worker forwards everything except /healthz.
import { BobActivityReq, WS_HELLO_TIMEOUT_MS } from '@radar/common';
import { Hono } from 'hono';
import { registerAdminRoutes } from '../admin';
import type { WorkspaceDeps } from '../deps';
import { insertMetric } from '../db/repo/metric';
import { appendEvent } from '../services/events';
import { exportEvents } from '../services/export';
import { truncateActivityText } from '../services/activity';
import { buildState } from '../services/state';
import { requireMember, requireRole } from './auth';
import { errorJson, parseWith, readJson, toErrorResponse } from './errors';
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

  registerLockRoutes(app, deps);
  registerFileRoutes(app, deps);
  registerTaskRoutes(app, deps);
  registerRequestRoutes(app, deps);
  registerProposalRoutes(app, deps);
  registerTeamRoutes(app, deps);
  registerAdminRoutes(app, deps);
  return app;
}
