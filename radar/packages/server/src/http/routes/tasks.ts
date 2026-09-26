// Task endpoints (R3 §2.4, §2.5, §2.9, §2.15, §2.19).
import { SubmitReq, TaskDiffRes, TasksQuery, type ActivateRes, type CancelRes, type SubmitRes, type TasksRes } from '@radar/common';
import type { Hono } from 'hono';
import { ctxOf, type WorkspaceDeps } from '../../deps';
import { getMember } from '../../db/repo/member';
import { buildTaskDiff } from '../../services/diff';
import { activateTask, cancelTask, listTaskItems, submitTask } from '../../services/tasks';
import { requireMember, requireRole } from '../auth';
import { parseWith, RadarError, readJson } from '../errors';

export function registerTaskRoutes(app: Hono, deps: WorkspaceDeps): void {
  app.get('/v1/tasks', (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder']);
    const q = parseWith(TasksQuery, c.req.query());
    // A coder lists only their own tasks; the team view is GET /v1/team (pm, mc).
    // R3 §7 my_tasks calls with ?owner=me, which means the caller (D-umar-04).
    const owner = q.owner === 'me' ? member.memberId : q.owner;
    if (owner !== undefined && owner !== member.memberId) throw new RadarError(403, 'FORBIDDEN', 'Hanya task milikmu sendiri.');
    const res: TasksRes = {
      tasks: listTaskItems(deps.db, member.memberId, q.status ?? 'open'),
      activeTaskId: getMember(deps.db, member.memberId)?.active_task_id ?? null,
    };
    return c.json(res);
  });

  app.post('/v1/tasks/:id/activate', (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder']);
    const res: ActivateRes = { activeTaskId: deps.transact(() => activateTask(deps.db, member.memberId, c.req.param('id'))) };
    return c.json(res);
  });

  app.post('/v1/tasks/:id/submit', async (c) => {
    const member = requireMember(deps.db, c.req.header('authorization'), ['coder']);
    const req = parseWith(SubmitReq, await readJson(c.req.raw));
    const taskId = c.req.param('id');
    const { files } = deps.transact((uow) => submitTask(ctxOf(deps, uow), member.memberId, taskId, req.summary));
    const res: SubmitRes = { taskId, status: 'review', files };
    return c.json(res);
  });

  app.post('/v1/tasks/:id/cancel', (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['mc']);
    const taskId = c.req.param('id');
    deps.transact((uow) => cancelTask(ctxOf(deps, uow), taskId));
    const res: CancelRes = { taskId, status: 'batal' };
    return c.json(res);
  });

  app.get('/v1/tasks/:id/diff', (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['pm', 'mc']);
    return c.json(TaskDiffRes.parse(buildTaskDiff(deps.db, c.req.param('id'), deps.now())));
  });
}
