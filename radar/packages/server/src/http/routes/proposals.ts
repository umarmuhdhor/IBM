// Proposals and the human decision (R3 §2.12–2.14). Only Mission Control may decide (MA-07).
import { DecisionReq, ProposalCreateReq, ProposalsQuery, type ProposalsRes } from '@radar/common';
import type { Hono } from 'hono';
import { ctxOf, type WorkspaceDeps } from '../../deps';
import { createProposal, decideProposalFlow, listProposalItems } from '../../services/proposals';
import { requireMember, requireRole } from '../auth';
import { parseWith, readJson } from '../errors';

export function registerProposalRoutes(app: Hono, deps: WorkspaceDeps): void {
  app.post('/v1/proposals', async (c) => {
    const pm = requireMember(deps.db, c.req.header('authorization'), ['pm']);
    const req = parseWith(ProposalCreateReq, await readJson(c.req.raw));
    const autoApply = deps.env.AUTO_APPLY_QUEUE === 'true';
    const res = deps.transact((uow) => createProposal(ctxOf(deps, uow), pm.memberId, req, autoApply));
    return c.json(res, 201);
  });

  app.get('/v1/proposals', (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['pm', 'mc']);
    const q = parseWith(ProposalsQuery, c.req.query());
    const res: ProposalsRes = { proposals: listProposalItems(deps.db, q.status) };
    return c.json(res);
  });

  app.post('/v1/proposals/:id/decision', async (c) => {
    requireRole(deps.db, c.req.header('authorization'), ['mc']);
    const req = parseWith(DecisionReq, await readJson(c.req.raw));
    return c.json(await decideProposalFlow(deps, c.req.param('id'), req));
  });
}
