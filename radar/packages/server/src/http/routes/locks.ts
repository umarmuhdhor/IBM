// `POST /v1/locks/check` (R3 §2.2) and `POST /v1/locks/revoke` (R3 §2.18, mc only).
import { LockCheckReq, RevokeReq, type LockCheckRes, type RevokeRes } from '@radar/common';
import type { Hono } from 'hono';
import { ctxOf, type WorkspaceDeps } from '../../deps';
import { insertMetric } from '../../db/repo/metric';
import { checkPaths, LOCK_CHECK_MAX_PATHS } from '../../services/check';
import { cleanPath } from '../../services/files';
import { revoke } from '../../services/locks';
import { requireMember, requireRole } from '../auth';
import { parseWith, RadarError, readJson } from '../errors';

/** `hook_rtt_ms` is only a rough figure (clocks differ); ignore values outside this window. */
const RTT_MAX_MS = 60_000;

export function pathOr422(raw: string): string {
  const path = cleanPath(raw);
  if (path === null) throw new RadarError(422, 'VALIDATION', `Path ${raw} di luar workspace.`);
  return path;
}

export function registerLockRoutes(app: Hono, deps: WorkspaceDeps): void {
  app.post('/v1/locks/check', async (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder', 'pm']);
    const req = parseWith(LockCheckReq, await readJson(c.req.raw));
    const paths = [...new Set(req.paths.map(pathOr422))];
    if (paths.length > LOCK_CHECK_MAX_PATHS) {
      throw new RadarError(422, 'VALIDATION', `Maksimal ${LOCK_CHECK_MAX_PATHS} path per panggilan.`);
    }
    const started = Date.now();
    const res: LockCheckRes = deps.transact((uow) => {
      const ctx = ctxOf(deps, uow);
      const out = checkPaths(ctx, member.memberId, paths);
      const serverMs = Date.now() - started;
      insertMetric(ctx.db, { ts: ctx.now, name: 'lock_check_ms', value: serverMs, tags: { memberId: member.memberId, paths: paths.length } });
      const rtt = ctx.now - req.clientTs;
      if (req.clientTs > 0 && rtt >= 0 && rtt <= RTT_MAX_MS) {
        insertMetric(ctx.db, { ts: ctx.now, name: 'hook_rtt_ms', value: rtt, tags: { memberId: member.memberId } });
      }
      return { ...out, serverMs };
    });
    return c.json(res);
  });

  app.post('/v1/locks/revoke', async (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['mc']);
    const req = parseWith(RevokeReq, await readJson(c.req.raw));
    const path = pathOr422(req.path);
    const next = deps.transact((uow) => revoke(ctxOf(deps, uow), path, req.reason, 'mc'));
    const res: RevokeRes = { path, nextHolder: next ? { taskId: next.task_id, memberId: next.owner_id } : null };
    return c.json(res);
  });
}
