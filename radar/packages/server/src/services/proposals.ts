// Proposals from the PM main agent and their approval in Mission Control (R3 §2.12–2.14, R4 §6). Nothing changes
// the workspace until a human approves, except `antre` decisions when AUTO_APPLY_QUEUE is on (PRD §7.3, I7).
import {
  DecisionPayload,
  PlanPayload,
  ReviewPayload,
  type DecisionReq,
  type DecisionRes,
  type ProposalCreateReq,
  type ProposalCreateRes,
  type ProposalItem,
  type ProposalStatus,
} from '@radar/common';
import type { z } from 'zod';
import type { CommitResult, CommitSnapshot } from '../committer';
import { ctxOf, type WorkspaceDeps } from '../deps';
import { getFileVersion } from '../db/repo/file';import { getLock, locksOfTask } from '../db/repo/lock';
import { getMember } from '../db/repo/member';
import { getMeta, setMeta } from '../db/repo/meta';
import { insertMetric } from '../db/repo/metric';
import { decideProposal, expirePendingReviews, getProposal, insertProposal, listProposals, type ProposalRow } from '../db/repo/proposal';
import { getRequest, setRequestStatus, type RequestRow } from '../db/repo/request';
import { insertReview } from '../db/repo/review';
import { getTask, insertTask, setCommitClaim, setCommitSha, tasksWithCommitClaim, type TaskRow } from '../db/repo/task';
import { touchesOf } from '../db/repo/touch';
import type { Db } from '../db/sql';
import { RadarError } from '../http/errors';
import { appendEvent } from './events';
import { cleanPath } from './files';
import { commitErrorCode } from './github';
import { commitClaimActive, enqueue, requireTask, returnTaskToWorking, transferNow, type LockCtx } from './locks';
import { addNotification, sendNote } from './notifications';
import { closeTask, taskOr404 } from './tasks';

const ACTIVE_TASK: readonly TaskRow['status'][] = ['terbuka', 'dikerjakan', 'review'];

// ---- create ----------------------------------------------------------------------------------------------------

function requireCoder(db: Db, memberId: string, what: string): void {
  const m = getMember(db, memberId);
  if (!m) throw new RadarError(422, 'VALIDATION', `${what}: member ${memberId} tidak ada.`);
  if (m.role !== 'coder') throw new RadarError(422, 'VALIDATION', `${what}: ${memberId} bukan coder (PM tidak memegang file).`);
}

function normalizePath(raw: string, where: string): string {
  const p = cleanPath(raw);
  if (p === null) throw new RadarError(422, 'VALIDATION', `${where}: path ${raw} tidak valid (harus relatif di dalam workspace).`);
  return p;
}

/** R3 §4.1 rules that need server state: coder owners, workspace paths; shape rules run again after normalising. */
function validatePlan(db: Db, payload: PlanPayload): PlanPayload {
  const tasks = payload.tasks.map((t) => {
    requireCoder(db, t.ownerId, `task ${t.ref}`);
    return {
      ...t,
      files: t.files.map((p) => normalizePath(p, `task ${t.ref} files`)),
      queuedFiles: t.queuedFiles.map((p) => normalizePath(p, `task ${t.ref} queuedFiles`)),
    };
  });
  const again = PlanPayload.safeParse({ ...payload, tasks });
  if (!again.success) {
    const i = again.error.issues[0];
    throw new RadarError(422, 'VALIDATION', `${i?.path.join('.') ?? 'plan'}: ${i?.message ?? 'rencana tidak valid'}`);
  }
  return again.data;
}

function proposalCreated(ctx: LockCtx, p: ProposalRow, payload: unknown, by: string): void {
  appendEvent(ctx.db, ctx.uow, {
    ts: ctx.now,
    actor: by,
    type: 'proposal.created',
    payload: { proposalId: p.id, kind: p.kind, refId: p.ref_id, reason: p.reason, payload },
  });
}

function proposalDecided(ctx: LockCtx, p: ProposalRow, status: ProposalStatus, by: string, note: string | null): void {
  appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: by, type: 'proposal.decided', payload: { proposalId: p.id, kind: p.kind, status, by, note } });
}

/** `POST /v1/proposals` (pm only). Validation failures are 422 with the path/task at fault, for the main agent. */
export function createProposal(ctx: LockCtx, pmId: string, req: ProposalCreateReq, autoApplyQueue: boolean): ProposalCreateRes {
  if (req.kind === 'plan') {
    const payload = validatePlan(ctx.db, req.payload);
    const p = insertProposal(ctx.db, { kind: 'plan', payload: JSON.stringify(payload), reason: req.reason, refId: null, createdBy: pmId, now: ctx.now });
    proposalCreated(ctx, p, payload, pmId);
    return { proposalId: p.id, status: 'menunggu' };
  }

  if (req.kind === 'decision') {
    const payload = req.payload;
    const request = getRequest(ctx.db, payload.requestId);
    if (!request) throw new RadarError(404, 'NOT_FOUND', `Permintaan ${payload.requestId} tidak ada.`);
    if (request.status !== 'terbuka') throw new RadarError(409, 'CONFLICT', `Permintaan ${request.id} berstatus ${request.status}, bukan terbuka.`);
    if (payload.newTask?.ownerId) requireCoder(ctx.db, payload.newTask.ownerId, 'newTask');
    const p = insertProposal(ctx.db, { kind: 'decision', payload: JSON.stringify(payload), reason: req.reason, refId: request.id, createdBy: pmId, now: ctx.now });
    setRequestStatus(ctx.db, request.id, 'diusulkan', { proposalId: p.id });
    proposalCreated(ctx, p, payload, pmId);
    if (payload.option === 'antre' && autoApplyQueue) {
      applyDecision(ctx, request, payload, p.id, true);
      decideProposal(ctx.db, p.id, 'diterapkan_otomatis', 'auto', ctx.now);
      proposalDecided(ctx, p, 'diterapkan_otomatis', 'auto', null);
      return { proposalId: p.id, status: 'diterapkan_otomatis' };
    }
    return { proposalId: p.id, status: 'menunggu' };
  }

  const payload = req.payload;
  const task = taskOr404(ctx.db, payload.taskId);
  if (task.status !== 'review') throw new RadarError(409, 'CONFLICT', `Task ${task.id} berstatus ${task.status}, belum di-submit untuk review.`);
  if (commitClaimActive(task, ctx.now)) throw new RadarError(409, 'CONFLICT', `Task ${task.id} sedang di-commit; coba lagi sebentar.`);
  for (const n of payload.notify) {
    if (!getMember(ctx.db, n.memberId)) throw new RadarError(422, 'VALIDATION', `notify: member ${n.memberId} tidak ada.`);
  }
  const p = insertProposal(ctx.db, { kind: 'review', payload: JSON.stringify(payload), reason: req.reason, refId: task.id, createdBy: pmId, now: ctx.now });
  // The newest review of a task replaces older ones that are still waiting.
  for (const id of expirePendingReviews(ctx.db, task.id, p.id)) {
    appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: 'server', type: 'proposal.decided', payload: { proposalId: id, kind: 'review', status: 'kedaluwarsa', by: 'server', note: `diganti ${p.id}` } });
  }
  proposalCreated(ctx, p, payload, pmId);
  // Recorded when the review is proposed, so the metric counts even if the PM rejects it (fase 05 step 6).
  if (payload.flags.length > 0) {
    appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: pmId, type: 'review.flagged', payload: { reviewId: p.id, taskId: task.id, flags: payload.flags } });
  }
  return { proposalId: p.id, status: 'menunggu' };
}

// ---- list ------------------------------------------------------------------------------------------------------

/** Display only: a broken payload is shown as null (and logged) instead of hiding the whole list. */
function parsePayload(p: ProposalRow): unknown {
  try {
    return JSON.parse(p.payload) as unknown;
  } catch (err) {
    console.error(`radar: proposal ${p.id} has an unreadable payload`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Decide path: the stored payload must still match its schema, else nothing is applied (500, logged). */
function storedPayload<S extends z.ZodType>(p: ProposalRow, schema: S): z.infer<S> {
  let raw: unknown;
  try {
    raw = JSON.parse(p.payload);
  } catch {
    raw = undefined;
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    console.error(`radar: proposal ${p.id} (${p.kind}) payload does not match its schema; nothing applied`);
    throw new RadarError(500, 'INTERNAL', `Isi usulan ${p.id} rusak; tidak ada yang diterapkan.`);
  }
  return r.data;
}

export function listProposalItems(db: Db, status: ProposalStatus | 'all' | undefined): ProposalItem[] {
  return listProposals(db, status === 'all' ? undefined : status).map((p) => ({
    id: p.id,
    kind: p.kind,
    status: p.status,
    payload: parsePayload(p),
    reason: p.reason,
    refId: p.ref_id,
    createdAt: p.created_at,
  }));
}

// ---- apply (R4 §6.1, §6.2) -------------------------------------------------------------------------------------

function applyPlan(ctx: LockCtx, p: ProposalRow, payload: PlanPayload): Record<string, unknown> {
  const baseCommit = getMeta(ctx.db, 'head_commit');
  const created = payload.tasks.map((t) => {
    const task = insertTask(ctx.db, {
      title: t.title,
      description: t.description,
      ownerId: t.ownerId,
      status: 'terbuka',
      baseCommit,
      planProposalId: p.id,
      now: ctx.now,
    });
    appendEvent(ctx.db, ctx.uow, {
      ts: ctx.now,
      actor: 'mc',
      type: 'task.created',
      payload: { taskId: task.id, title: task.title, description: task.description, ownerId: task.owner_id, status: 'terbuka', files: t.files, queuedFiles: t.queuedFiles, adhoc: false },
    });
    return { plan: t, task };
  });
  for (const { plan, task } of created) for (const path of plan.files) enqueue(ctx, path, task, 'plan');
  for (const { plan, task } of created) for (const path of plan.queuedFiles) enqueue(ctx, path, task, 'plan');
  return { tasks: created.map(({ task }) => task.id) };
}

function holderLabel(db: Db, path: string): string {
  const lock = getLock(db, path);
  return lock ? lock.task_id : 'pemegang sekarang';
}

function applyDecision(ctx: LockCtx, request: RequestRow, payload: DecisionPayload, proposalId: string, auto: boolean): Record<string, unknown> {
  if (request.status !== 'terbuka' && request.status !== 'diusulkan') {
    throw new RadarError(409, 'CONFLICT', `Permintaan ${request.id} berstatus ${request.status}.`);
  }
  const reqTask = requireTask(ctx.db, request.requester_task);
  if (!ACTIVE_TASK.includes(reqTask.status)) throw new RadarError(409, 'CONFLICT', `Task peminta ${reqTask.id} sudah ${reqTask.status}.`);
  const path = request.path;
  const holder = holderLabel(ctx.db, path);
  let message: string;
  let applied: Record<string, unknown>;
  if (payload.option === 'antre') {
    const pos = enqueue(ctx, path, reqTask, 'decision');
    message = pos === 0 ? `${path} sudah bebas dan kini dipesan untuk ${reqTask.id}.` : `Kamu antre ${path} di posisi ${pos}, setelah ${holder}.`;
    applied = { option: 'antre', path, taskId: reqTask.id, queuePos: pos };
  } else if (payload.option === 'pindahkan') {
    transferNow(ctx, path, reqTask);
    message = `${path} kini milikmu (${reqTask.id}).`;
    applied = { option: 'pindahkan', path, taskId: reqTask.id };
  } else {
    const spec = payload.newTask;
    if (!spec) throw new RadarError(500, 'INTERNAL', `Usulan ${proposalId} pecah tanpa newTask; tidak ada yang diterapkan.`);
    const child = insertTask(ctx.db, {
      title: spec.title,
      description: spec.description,
      ownerId: spec.ownerId ?? request.requester_member,
      status: 'terbuka',
      baseCommit: getMeta(ctx.db, 'head_commit'),
      parentTaskId: reqTask.id,
      now: ctx.now,
    });
    appendEvent(ctx.db, ctx.uow, {
      ts: ctx.now,
      actor: auto ? 'auto' : 'mc',
      type: 'task.created',
      payload: { taskId: child.id, title: child.title, description: child.description, ownerId: child.owner_id, status: 'terbuka', files: [], queuedFiles: [path], adhoc: false, parentTaskId: reqTask.id },
    });
    const pos = enqueue(ctx, path, child, 'decision');
    message = `Bagian ${path} dipindah ke task baru ${child.id}, mulai setelah ${holder}.`;
    applied = { option: 'pecah', path, taskId: child.id, queuePos: pos };
  }
  setRequestStatus(ctx.db, request.id, 'diputuskan', { outcome: payload.option, decidedAt: ctx.now });
  appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: auto ? 'auto' : 'mc', type: 'request.decided', payload: { requestId: request.id, outcome: payload.option, proposalId, auto } });
  insertMetric(ctx.db, { ts: ctx.now, name: 'block_to_decision_ms', value: ctx.now - request.created_at, tags: { requestId: request.id, outcome: payload.option } });
  addNotification(ctx, { memberId: request.requester_member, kind: 'decision', message, ref: request.id });
  return applied;
}

function rejectRequest(ctx: LockCtx, request: RequestRow, proposalId: string): void {
  setRequestStatus(ctx.db, request.id, 'ditolak', { decidedAt: ctx.now });
  appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: 'mc', type: 'request.decided', payload: { requestId: request.id, outcome: 'ditolak', proposalId, auto: false } });
  insertMetric(ctx.db, { ts: ctx.now, name: 'block_to_decision_ms', value: ctx.now - request.created_at, tags: { requestId: request.id, outcome: 'ditolak' } });
  addNotification(ctx, { memberId: request.requester_member, kind: 'decision', message: `Permintaan ${request.path} ditolak PM.`, ref: request.id });
}

// ---- decide (R3 §2.14, mc only) --------------------------------------------------------------------------------

function pendingOr409(db: Db, id: string): ProposalRow {
  const p = getProposal(db, id);
  if (!p) throw new RadarError(404, 'NOT_FOUND', `Usulan ${id} tidak ada.`);
  if (p.status !== 'menunggu') throw new RadarError(409, 'CONFLICT', `Usulan ${id} berstatus ${p.status}, bukan menunggu.`);
  return p;
}

function decideNow(ctx: LockCtx, p: ProposalRow, status: 'disetujui' | 'ditolak', note: string | null): void {
  if (!decideProposal(ctx.db, p.id, status, 'mc', ctx.now, note)) throw new RadarError(409, 'CONFLICT', `Usulan ${p.id} sudah diputuskan.`);
  proposalDecided(ctx, p, status, 'mc', note);
}


/**
 * Tx1 of a decision, synchronous and inside the caller's transaction: rejects, plans, decisions and `kembalikan`
 * finish here; an approved `setujui*` review returns its commit claim instead.
 */
export function decideStart(ctx: LockCtx, id: string, req: DecisionReq): DecisionRes | { claim: CommitClaim } {
  const note = req.note ?? null;
  const p = pendingOr409(ctx.db, id);
  if (!req.approve) {
    decideNow(ctx, p, 'ditolak', note);
    if (p.kind === 'decision') {
      const request = p.ref_id ? getRequest(ctx.db, p.ref_id) : null;
      if (request && (request.status === 'terbuka' || request.status === 'diusulkan')) rejectRequest(ctx, request, p.id);
    }
    return { proposalId: p.id, status: 'ditolak' };
  }
  if (p.kind === 'plan') {
    decideNow(ctx, p, 'disetujui', note);
    return { proposalId: p.id, status: 'disetujui', applied: applyPlan(ctx, p, storedPayload(p, PlanPayload)) };
  }
  if (p.kind === 'decision') {
    const request = p.ref_id ? getRequest(ctx.db, p.ref_id) : null;
    if (!request) throw new RadarError(404, 'NOT_FOUND', `Permintaan ${p.ref_id ?? '?'} tidak ada.`);
    decideNow(ctx, p, 'disetujui', note);
    return { proposalId: p.id, status: 'disetujui', applied: applyDecision(ctx, request, storedPayload(p, DecisionPayload), p.id, false) };
  }
  const review = storedPayload(p, ReviewPayload);
  const task = taskOr404(ctx.db, review.taskId);
  if (task.status !== 'review') throw new RadarError(409, 'CONFLICT', `Task ${task.id} berstatus ${task.status}, bukan review.`);
  if (review.verdict === 'kembalikan') {
    decideNow(ctx, p, 'disetujui', note);
    applyReviewRecord(ctx, p, task, review, null);
    returnTaskToWorking(ctx, task.id, 'mc');
    const msg = review.notes ? `Review ${task.id} dikembalikan: ${review.notes}` : `Review ${task.id} dikembalikan, lanjutkan perbaikan.`;
    addNotification(ctx, { memberId: task.owner_id, kind: 'review', message: msg, ref: task.id });
    return { proposalId: p.id, status: 'disetujui', applied: { taskId: task.id, verdict: 'kembalikan' } };
  }
  return { claim: claimCommit(ctx, p, task, review, note) };
}

/**
 * `POST /v1/proposals/:id/decision`. Plans and decisions apply in one transaction. An approved `setujui*` review
 * commits between two transactions (R4 §6.3): Tx1 claims, the committer runs outside any transaction, Tx2
 * re-validates and finishes, or the claim is dropped and `commit.push_failed` recorded.
 */
export async function decideProposalFlow(deps: WorkspaceDeps, id: string, req: DecisionReq): Promise<DecisionRes> {
  const direct = deps.transact((uow) => decideStart(ctxOf(deps, uow), id, req));
  if (!('claim' in direct)) return direct;

  const { claim } = direct;
  let result: CommitResult;
  try {
    result = await deps.committer.commitTask(claim.snapshot);
  } catch (err) {
    // Stable codes in the event (never secrets); the raw message stays in the server log only.
    const code = commitErrorCode(err);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`radar: commit of ${claim.taskId} failed [${code}]`, err instanceof Error ? (err.stack ?? message) : message);
    let head: string | null = null;
    if (code === 'non_fast_forward' && typeof deps.committer.refreshHead === 'function') {
      try {
        head = await deps.committer.refreshHead(claim.snapshot.branch);
      } catch {
        head = null;
      }
    }
    deps.transact((uow) => {
      const ctx = ctxOf(deps, uow);
      if (getTask(ctx.db, claim.taskId)?.commit_started_at === claim.startedAt) setCommitClaim(ctx.db, claim.taskId, null);
      if (head) setMeta(ctx.db, 'head_commit', head);
      appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: 'server', type: 'commit.push_failed', payload: { taskId: claim.taskId, sha: null, error: code } });
    });
    // The raw error stays in the server log and the event; the client gets a fixed message.
    throw new RadarError(409, 'CONFLICT', `Commit ${claim.taskId} gagal. Task tetap review; coba lagi.`);
  }
  const done = deps.transact((uow) => finishCommit(ctxOf(deps, uow), claim, result));
  if (!done) throw new RadarError(409, 'CONFLICT', `Keputusan ${claim.proposalId} berubah selama commit berjalan; tidak ada yang diterapkan.`);
  return done;
}

export interface CommitClaim {
  proposalId: string;
  taskId: string;
  startedAt: number;
  review: ReviewPayload;
  note: string | null;
  snapshot: CommitSnapshot;
}

/** R4 §6.3 Tx1: one active commit claim per workspace; the snapshot is taken from each touch's last version. */
function claimCommit(ctx: LockCtx, p: ProposalRow, task: TaskRow, review: ReviewPayload, note: string | null): CommitClaim {
  const busy = tasksWithCommitClaim(ctx.db).find((t) => commitClaimActive(t, ctx.now));
  if (busy) throw new RadarError(409, 'CONFLICT', `Commit lain sedang berjalan (${busy.id}); coba lagi sebentar.`);
  setCommitClaim(ctx.db, task.id, ctx.now);
  const owner = getMember(ctx.db, task.owner_id);
  const held = new Set(locksOfTask(ctx.db, task.id).map((l) => l.path));
  const files = touchesOf(ctx.db, task.id)
    .filter((t) => held.has(t.path))
    .map((t) => {
      const v = getFileVersion(ctx.db, t.path, t.last_version);
      return { path: t.path, firstVersion: t.first_version, content: t.deleted || !v || v.deleted ? null : (v.content ?? '') };
    })
    // Created and deleted inside the task: nothing on GitHub to delete (a tree entry with sha null would be 422).
    .filter((f) => f.content !== null || f.firstVersion > 0)
    .map(({ path, content }) => ({ path, content }));
  const reviewer = getMember(ctx.db, p.created_by);
  return {
    proposalId: p.id,
    taskId: task.id,
    startedAt: ctx.now,
    review,
    note,
    snapshot: {
      taskId: task.id,
      title: task.title,
      summary: task.submit_summary,
      author: { name: owner?.git_name ?? task.owner_id, email: owner?.git_email ?? '' },
      // R4 §6.3 step 2: the commit is built on the current meta head (refreshed after a
      // non-fast-forward), not the task's opening base. task.base_commit stays historical for the diff.
      baseCommit: getMeta(ctx.db, 'head_commit'),
      branch: getMeta(ctx.db, 'branch') ?? 'main',
      proposalId: p.id,
      reviewer: reviewer ? { name: reviewer.git_name || reviewer.name, role: reviewer.role, email: reviewer.git_email || '' } : null,
      files,
    },
  };
}

/**
 * R4 §6.3 Tx2: finishes only if the proposal still waits and the claim is still ours. Otherwise it only drops its
 * own claim and returns null.
 */
export function finishCommit(ctx: LockCtx, claim: CommitClaim, result: CommitResult): DecisionRes | null {
  const p = getProposal(ctx.db, claim.proposalId);
  const task = getTask(ctx.db, claim.taskId);
  const ours = task?.commit_started_at === claim.startedAt;
  const stale = !p ? 'proposal gone' : p.status !== 'menunggu' ? `proposal ${p.status}` : !task ? 'task gone' : !ours ? 'claim taken over' : task.status !== 'review' ? `task ${task.status}` : null;
  if (stale !== null || !p || !task) {
    console.error(`radar: commit ${result.sha} of ${claim.taskId} not applied: ${stale ?? 'unknown'}`);
    if (ours) setCommitClaim(ctx.db, claim.taskId, null);
    return null;
  }
  setCommitSha(ctx.db, task.id, result.sha, ctx.now);
  setCommitClaim(ctx.db, task.id, null);
  decideNow(ctx, p, 'disetujui', claim.note);
  applyReviewRecord(ctx, p, task, claim.review, result.sha);
  const files = claim.snapshot.files.map((f) => f.path);
  closeTask(ctx, task, 'selesai', 'mc');
  // The stub sha is not a real commit, so the workspace head only moves on a real push.
  if (result.pushed) setMeta(ctx.db, 'head_commit', result.sha);
  appendEvent(ctx.db, ctx.uow, {
    ts: ctx.now,
    actor: 'server',
    type: 'commit.created',
    payload: { taskId: task.id, sha: result.sha, author: task.owner_id, files, pushed: result.pushed, ...(result.url ? { url: result.url } : {}) },
  });
  addNotification(ctx, { memberId: task.owner_id, kind: 'review', message: `Task ${task.id} disetujui dan di-commit (${result.sha.slice(0, 7)}).`, ref: task.id });
  if (claim.review.verdict === 'setujui_beri_tahu') {
    for (const n of claim.review.notify) sendNote(ctx, { memberId: n.memberId, kind: 'review', message: n.message, ref: task.id }, 'mc');
  }
  return { proposalId: p.id, status: 'disetujui', applied: { taskId: task.id, verdict: claim.review.verdict, sha: result.sha, pushed: result.pushed, files } };
}

function applyReviewRecord(ctx: LockCtx, p: ProposalRow, task: TaskRow, review: ReviewPayload, sha: string | null): void {
  const r = insertReview(ctx.db, { taskId: task.id, proposalId: p.id, verdict: review.verdict, notes: review.notes, commitSha: sha, now: ctx.now });
  appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: 'mc', type: 'review.created', payload: { reviewId: r.id, taskId: task.id, verdict: review.verdict } });
}

/**
 * R4 §6.3 point 5: claims older than COMMIT_CLAIM_TTL_MS were left by an evicted object. Clear them so the
 * files unlock and Mission Control can offer "Coba lagi". Idempotent; run when the object starts.
 */
export function expireCommitClaims(ctx: LockCtx): string[] {
  const expired = tasksWithCommitClaim(ctx.db).filter((t) => !commitClaimActive(t, ctx.now));
  for (const t of expired) {
    setCommitClaim(ctx.db, t.id, null);
    appendEvent(ctx.db, ctx.uow, { ts: ctx.now, actor: 'server', type: 'commit.push_failed', payload: { taskId: t.id, sha: null, error: 'claim_expired' } });
  }
  return expired.map((t) => t.id);
}
