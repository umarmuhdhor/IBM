// P1 file routes: `POST /v1/ai-edits` (R3 §2.20, BC-05) and `GET /v1/files/history` (R3 §2.22, UI-06).
import { AiEditsReq } from '@radar/common';
import type { Hono } from 'hono';
import type { WorkspaceDeps } from '../../deps';
import { markAiEdits } from '../../services/ai-edits';
import { fileHistory, HISTORY_DEFAULT_LIMIT } from '../../services/history';
import { requireMember, requireRole } from '../auth';
import { parseWith, readJson } from '../errors';
import { HistoryQuery } from '../query';
import { pathOr422 } from './locks';

export function registerFileRoutes(app: Hono, deps: WorkspaceDeps): void {
  app.post('/v1/ai-edits', async (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder']);
    const req = parseWith(AiEditsReq, await readJson(c.req.raw));
    const paths = [...new Set(req.paths.map(pathOr422))];
    deps.transact((uow) => markAiEdits(deps.db, uow, deps.now(), member.memberId, paths, req.tool));
    return c.body(null, 204);
  });

  app.get('/v1/files/history', (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['coder', 'pm', 'mc']);
    const q = parseWith(HistoryQuery, c.req.query());
    return c.json(fileHistory(deps.db, pathOr422(q.path), q.limit ?? HISTORY_DEFAULT_LIMIT));
  });
}
