// Hono app that runs inside the Durable Object (fase 03 step 9). The Worker forwards everything except /healthz.
import {
  ADMIN_FILES_MAX_BATCH_BYTES,
  AdminFilesReq,
  AdminJoinCodeReq,
  BobActivityReq,
  encodeInvite,
  JoinReq,
  normalizeJoinCode,
  OpenWorkspaceReq,
  WS_HELLO_TIMEOUT_MS,
  type JoinRes,
  type OpenWorkspaceRes,
} from '@radar/common';
import { Hono, type MiddlewareHandler } from 'hono';
import { createJoinCode, importFiles, initWorkspace, registerAdminRoutes } from '../admin';
import { sha256Hex } from '../crypto';
import type { WorkspaceDeps } from '../deps';
import { findJoinCode } from '../db/repo/join-code';
import { getMeta } from '../db/repo/meta';
import { getMember } from '../db/repo/member';
import { insertMetric } from '../db/repo/metric';
import { appendEvent } from '../services/events';
import { exportEvents } from '../services/export';
import { truncateActivityText } from '../services/activity';
import { addMemberForCode, rotateToken } from '../services/join';
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

const sameName = (a: string | undefined, b: string) =>
  a !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase();

export function createApp(deps: WorkspaceDeps): Hono {
  const app = new Hono();
  app.onError((err) => toErrorResponse(err));
  app.notFound(() => errorJson(404, 'NOT_FOUND', 'This endpoint does not exist.'));

  app.get('/ws', async (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket')
      return errorJson(426, 'BAD_REQUEST', 'Needs the header Upgrade: websocket.');
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // No tags: client kind and member are only known after `hello` (fase 03 step 11).
    deps.ctx.acceptWebSocket(server);
    deps.hub.setAttachment(server, {
      state: 'pending',
      helloDeadline: deps.now() + WS_HELLO_TIMEOUT_MS,
    });
    await deps.scheduler.reschedule();
    return new Response(null, { status: 101, webSocket: client });
  });

  app.get('/v1/state', (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['coder', 'pm', 'mc']);
    return c.json(buildState(deps.db, deps.workspaceId()));
  });

  app.get('/v1/events/export', (c) => {
    if (deps.env.PUBLIC_EXPORT !== 'true')
      requireRole(deps.db, c.req.header('authorization'), ['coder', 'pm', 'mc']);
    const q = parseWith(ExportQuery, c.req.query());
    return c.json(exportEvents(deps.db, deps.workspaceId(), q, deps.now()));
  });

  // IN-03 (D-alief-09): no token yet, the short code is the credential. Limited per client IP so codes cannot be
  // guessed quickly (40 bits); a wrong or expired code is 404 without saying which.
  app.post('/v1/join', async (c) => {
    const retry = deps.rateLimiter.hit(
      `join:${c.req.header('cf-connecting-ip') ?? 'unknown'}`,
      deps.now(),
    );
    if (retry > 0) {
      const res = errorJson(
        429,
        'RATE_LIMITED',
        `Too many attempts. Try again in ${retry} seconds.`,
      );
      res.headers.set('retry-after', String(retry));
      return res;
    }
    const req = parseWith(JoinReq, await readJson(c.req.raw));
    const code = normalizeJoinCode(req.code);
    const hash = code === null ? null : sha256Hex(code);
    const found = hash === null ? null : findJoinCode(deps.db, hash, deps.now());
    const notFound = new RadarError(
      404,
      'NOT_FOUND',
      'This join code is wrong or has expired. Ask the workspace owner for a new code.',
    );
    if (!found || hash === null) throw notFound;
    const workspace = deps.workspaceId();
    // D-alief-11: an owner code connects the owner's app as Mission Control; name and role are ignored.
    if (found.owner) {
      const res: JoinRes = { workspace, member: null, role: 'mc', token: rotateToken(deps, null) };
      return c.json(res);
    }
    // D-alief-10: an open code creates the member on first use; after that it signs the same member in again.
    let memberId = found.memberId;
    if (memberId === null) {
      if (!req.name || !req.role)
        throw new RadarError(422, 'VALIDATION', 'Enter your name and pick a role to join.');
      memberId = addMemberForCode(deps, hash, req.name, req.role);
    }
    const member = getMember(deps.db, memberId);
    if (!member) throw notFound;
    // D-alief-13: a used open code is not a seat anyone can take. Only the member it created (same name) may redeem
    // it again, e.g. on a new Mac; anyone else is refused and the member stays signed in.
    if (found.open && found.memberId !== null && !sameName(req.name, member.name)) {
      throw new RadarError(
        409,
        'CONFLICT',
        `This code was already used by ${member.name}. Ask the owner for a new code.`,
      );
    }
    const token = rotateToken(deps, member.id);
    const res: JoinRes = {
      workspace,
      member: member.id,
      role: member.role,
      invite: encodeInvite({
        server: new URL(c.req.url).origin,
        workspace,
        member: member.id,
        token,
      }),
    };
    return c.json(res);
  });

  // IN-03: Mission Control (the owner's app) makes join codes for teammates without the admin secret.
  // Owner codes come only from the admin secret (`admin init` / `admin code --owner`).
  app.post('/v1/join-codes', async (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['mc']);
    const req = parseWith(AdminJoinCodeReq, await readJson(c.req.raw));
    if (req.owner)
      throw new RadarError(403, 'FORBIDDEN', 'Owner codes are made with the admin secret.');
    return c.json(createJoinCode(deps, req), 201);
  });

  // D-alief-12: the owner's app opens a folder as the workspace, like Share in Google Docs. One workspace per server:
  // an empty server lets anyone start it (limited per IP); after that only the current Mission Control token can
  // replace it, which deletes everything. The owner becomes member A and gets a first open code to share.
  app.post('/v1/workspace/open', async (c) => {
    const retry = deps.rateLimiter.hit(
      `open:${c.req.header('cf-connecting-ip') ?? 'unknown'}`,
      deps.now(),
    );
    if (retry > 0) {
      const res = errorJson(
        429,
        'RATE_LIMITED',
        `Too many attempts. Try again in ${retry} seconds.`,
      );
      res.headers.set('retry-after', String(retry));
      return res;
    }
    const req = parseWith(OpenWorkspaceReq, await readJson(c.req.raw));
    const current = getMeta(deps.db, 'workspace_name');
    if (current !== null) {
      if (principalFromHeader(deps.db, c.req.header('authorization'))?.kind !== 'mc') {
        throw new RadarError(
          409,
          'CONFLICT',
          `This server already has the workspace ${current}. Ask its owner for a join code, or use your own server to share a folder.`,
        );
      }
      await deps.wipe();
    }
    const tokens = initWorkspace(deps, {
      workspace: req.workspace,
      branch: 'main',
      members: [{ id: 'A', name: req.owner.name, role: req.owner.role }],
    });
    const code = createJoinCode(deps, {});
    const server = new URL(c.req.url).origin;
    const res: OpenWorkspaceRes = {
      workspace: req.workspace,
      member: 'A',
      invite: encodeInvite({ server, workspace: req.workspace, member: 'A', token: tokens.A! }),
      mcToken: tokens.mc!,
      code: code.code,
      expiresAt: code.expiresAt,
    };
    return c.json(res, 201);
  });

  // D-alief-12: the owner's app uploads the folder in batches, like `admin init --repo-dir`. No head commit: a folder
  // opened from the app is not tied to the GitHub repo, so approved tasks are committed locally only.
  app.post('/v1/workspace/files', async (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['mc']);
    const req = parseWith(
      AdminFilesReq,
      await readJson(c.req.raw, 2 * ADMIN_FILES_MAX_BATCH_BYTES + 64 * 1024),
    );
    if (req.headCommit !== null)
      throw new RadarError(422, 'VALIDATION', 'headCommit must be null here.');
    return c.json(await importFiles(deps, req));
  });

  // D-alief-12: the owner stops sharing. Everything on the server is removed and every socket closes, so the
  // empty server can be claimed again by whoever shares a folder next. Files on everyone's Mac stay.
  app.post('/v1/workspace/close', async (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['mc']);
    await deps.wipe();
    return c.json({ ok: true as const });
  });

  app.post('/v1/bob/activity', async (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder', 'pm']);
    const req = parseWith(BobActivityReq, truncateActivityText(await readJson(c.req.raw)));
    const now = deps.now();
    const { accepted, droppedToReport } = deps.limiter.hit(member.memberId, now);
    if (droppedToReport > 0) {
      deps.transact(() =>
        insertMetric(deps.db, {
          ts: now,
          name: 'activity_dropped',
          value: droppedToReport,
          tags: { memberId: member.memberId },
        }),
      );
    }
    if (!accepted) return c.body(null, 204);
    // memberId comes from the token, never from the body; clientTs is not stored (R3 §2.24).
    const payload = { memberId: member.memberId, ...req };
    delete payload.clientTs;
    deps.transact((uow) =>
      appendEvent(deps.db, uow, { ts: now, actor: member.memberId, type: 'bob.activity', payload }),
    );
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
    const res = errorJson(
      429,
      'RATE_LIMITED',
      `Too many requests. Try again in ${retry} seconds.`,
    );
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
