// `GET /v1/state` and the WS `state`/`snapshot` payloads (R3 §2.21, §3). File contents only go to sync clients.
import type {
  AllocationSource,
  LockState,
  ProposalKind,
  ProposalStatus,
  RequestSource,
  RequestStatus,
  StateRes,
  TaskStatus,
  WsMessageOf,
} from '@radar/common';
import { lastEventId, recentEvents } from '../db/repo/event';
import { listFileMeta, listFilesWithContent } from '../db/repo/file';
import { listMembers } from '../db/repo/member';
import { getMeta } from '../db/repo/meta';
import type { Db } from '../db/sql';
import { rowsToEvents } from './events';

const RECENT_EVENTS = 100;

type LockRow = { path: string; task_id: string; member_id: string; state: LockState };
type AllocationRow = { task_id: string; path: string; queue_pos: number; source: AllocationSource };

function locksWithQueue(db: Db) {
  const locks = db.all<LockRow>('SELECT path, task_id, member_id, state FROM lock ORDER BY path');
  const queued = db.all<AllocationRow>('SELECT task_id, path, queue_pos, source FROM allocation WHERE queue_pos > 0 ORDER BY path, queue_pos');
  const queues = new Map<string, string[]>();
  for (const a of queued) queues.set(a.path, [...(queues.get(a.path) ?? []), a.task_id]);
  return locks.map((l) => ({ path: l.path, taskId: l.task_id, memberId: l.member_id, state: l.state, queue: queues.get(l.path) ?? [] }));
}

export function workspaceView(db: Db, fallbackId: string) {
  const id = getMeta(db, 'workspace_id') ?? fallbackId;
  return { id, name: getMeta(db, 'workspace_name') ?? id, headCommit: getMeta(db, 'head_commit'), repoUrl: getMeta(db, 'repo_url') };
}

export function buildState(db: Db, fallbackId: string): StateRes {
  const members = listMembers(db).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    color: m.color,
    online: m.online === 1,
    stale: false,
    activeTaskId: m.active_task_id,
    blocked: false,
    writingUntil: 0,
  }));

  const allocationRows = db.all<AllocationRow>('SELECT task_id, path, queue_pos, source FROM allocation ORDER BY path, queue_pos');
  const taskRows = db.all<{
    id: string;
    title: string;
    description: string;
    owner_id: string;
    status: TaskStatus;
    adhoc: number;
    parent_task_id: string | null;
    edit_count: number;
    commit_sha: string | null;
    submit_summary: string | null;
  }>('SELECT id, title, description, owner_id, status, adhoc, parent_task_id, edit_count, commit_sha, submit_summary FROM task ORDER BY seq');
  const tasks = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    ownerId: t.owner_id,
    status: t.status,
    files: allocationRows.filter((a) => a.task_id === t.id && a.queue_pos === 0).map((a) => a.path),
    queuedFiles: allocationRows.filter((a) => a.task_id === t.id && a.queue_pos > 0).map((a) => a.path),
    adhoc: t.adhoc === 1,
    parentTaskId: t.parent_task_id,
    editCount: t.edit_count,
    commitSha: t.commit_sha,
    summary: t.submit_summary,
  }));

  const files = listFileMeta(db).map((f) => ({
    path: f.path,
    version: f.version,
    updatedBy: f.updated_by,
    updatedAt: f.updated_at,
    writingUntil: 0,
    deleted: f.deleted === 1,
  }));

  const requests = db
    .all<{
      id: string;
      path: string;
      status: RequestStatus;
      source: RequestSource;
      requester_member: string;
      requester_task: string;
      holder_member: string;
      holder_task: string;
      created_at: number;
      outcome: string | null;
    }>('SELECT id, path, status, source, requester_member, requester_task, holder_member, holder_task, created_at, outcome FROM request ORDER BY seq')
    .map((r) => ({
      id: r.id,
      path: r.path,
      status: r.status,
      source: r.source,
      requesterMemberId: r.requester_member,
      requesterTaskId: r.requester_task,
      holderMemberId: r.holder_member,
      holderTaskId: r.holder_task,
      createdAt: r.created_at,
      outcome: r.outcome,
    }));

  const proposals = db
    .all<{
      id: string;
      kind: ProposalKind;
      status: ProposalStatus;
      ref_id: string | null;
      reason: string;
      payload: string;
      created_at: number;
      decided_by: string | null;
      decision_note: string | null;
    }>('SELECT id, kind, status, ref_id, reason, payload, created_at, decided_by, decision_note FROM proposal ORDER BY seq')
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      status: p.status,
      refId: p.ref_id,
      reason: p.reason,
      payload: JSON.parse(p.payload) as unknown,
      createdAt: p.created_at,
      decidedBy: p.decided_by,
      note: p.decision_note,
    }));

  return {
    workspace: workspaceView(db, fallbackId),
    members,
    tasks,
    locks: locksWithQueue(db),
    allocations: allocationRows.map((a) => ({ taskId: a.task_id, path: a.path, queuePos: a.queue_pos, source: a.source })),
    files,
    requests,
    proposals,
    recentEvents: rowsToEvents(recentEvents(db, RECENT_EVENTS)),
    cursor: lastEventId(db),
  };
}

/** WS `snapshot` for a sync client. With `knownVersions`, files the client already has at that version are left out. */
export function buildSnapshot(db: Db, knownVersions: Record<string, number> | undefined): WsMessageOf<'snapshot'>['d'] {
  const files = listFilesWithContent(db)
    .filter((f) => knownVersions?.[f.path] !== f.version)
    .map((f) => ({
      path: f.path,
      version: f.version,
      hash: f.deleted ? null : f.hash,
      content: f.deleted ? null : f.content,
      deleted: f.deleted === 1,
    }));
  return { files, locks: locksWithQueue(db), cursor: lastEventId(db) };
}
