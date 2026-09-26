// Team overview, activity feed, brief and PM notes (R3 §2.3, §2.8, §2.10, §2.16).
import { ActivityQuery, BriefQuery, NotifyReq, type NotifyRes } from '@radar/common';
import type { Hono } from 'hono';
import { ctxOf, type WorkspaceDeps } from '../../deps';
import { buildBrief } from '../../services/brief';
import { requireMember as memberRow } from '../../services/locks';
import { sendNote } from '../../services/notifications';
import { buildTeam, listActivity } from '../../services/team';
import { requireMember, requireRole } from '../auth';
import { parseWith, readJson } from '../errors';

const ACTIVITY_DEFAULT_LIMIT = 20;

export function registerTeamRoutes(app: Hono, deps: WorkspaceDeps): void {
  app.get('/v1/team', (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['pm', 'mc']);
    return c.json(buildTeam(deps.db, deps.hub, deps.now()));
  });

  app.get('/v1/activity', (c) => {
    requireMember(deps.db, c.req.header('authorization'), ['coder', 'pm']);
    const q = parseWith(ActivityQuery, c.req.query());
    return c.json(listActivity(deps.db, q.path, q.limit ?? ACTIVITY_DEFAULT_LIMIT));
  });

  app.get('/v1/brief', (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder', 'pm']);
    const q = parseWith(BriefQuery, c.req.query());
    return c.json(buildBrief(deps.db, member.memberId, q.kind, q.since, deps.now()));
  });

  app.post('/v1/notify', async (c) => {
    const pm = requireMember(deps.db, c.req.header('authorization'), ['pm']);
    const req = parseWith(NotifyReq, await readJson(c.req.raw));
    const row = deps.transact((uow) => {
      const ctx = ctxOf(deps, uow);
      memberRow(ctx.db, req.memberId);
      return sendNote(ctx, { memberId: req.memberId, kind: 'pm_note', message: req.message, ref: null }, pm.memberId);
    });
    const res: NotifyRes = { notificationId: row.id };
    return c.json(res, 201);
  });
}
