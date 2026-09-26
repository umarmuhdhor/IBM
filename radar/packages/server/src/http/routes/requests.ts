// Blocks and file requests (R3 §2.6, §2.7, §2.11).
import { RequestFileReq, RequestsQuery, type RequestsRes } from '@radar/common';
import type { Hono } from 'hono';
import { ctxOf, type WorkspaceDeps } from '../../deps';
import { lastBlock, listRequestItems, requestFile } from '../../services/requests';
import { requireMember, requireRole } from '../auth';
import { parseWith, readJson } from '../errors';
import { pathOr422 } from './locks';

export function registerRequestRoutes(app: Hono, deps: WorkspaceDeps): void {
  app.get('/v1/blocks/last', (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder']);
    return c.json(lastBlock(deps.db, member.memberId, deps.now()));
  });

  app.post('/v1/requests', async (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder']);
    const req = parseWith(RequestFileReq, await readJson(c.req.raw));
    const path = pathOr422(req.path);
    const { status, body } = deps.transact((uow) => requestFile(ctxOf(deps, uow), member.memberId, path, req.reason));
    return c.json(body, status);
  });

  app.get('/v1/requests', (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['pm', 'mc']);
    const q = parseWith(RequestsQuery, c.req.query());
    const res: RequestsRes = { requests: listRequestItems(deps.db, q.status) };
    return c.json(res);
  });
}
