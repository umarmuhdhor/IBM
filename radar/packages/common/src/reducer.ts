// Shared event reducer (R3 §6). Pure: no Date.now(), no I/O; every time comes from `ev.ts`.
// Mission Control, the desktop app and the replay all rebuild the same RadarState from the same events.
import {
  BOB_ACTIVITY_MAX_ITEMS,
  FEED_MAX_ITEMS,
  MEMBER_COLORS,
  WRITING_INDICATOR_MS,
} from './constants.js';
import { feedText } from './events.js';
import { parseRadarEvent, type RadarEvent, type StateRes } from './schemas.js';
import type {
  BobActivityItem,
  FeedItem,
  FileView,
  LockView,
  MemberView,
  ProposalView,
  RequestView,
  TaskView,
  WorkspaceView,
} from './types.js';

export interface RadarState {
  workspace: WorkspaceView;
  members: Record<string, MemberView>;
  tasks: Record<string, TaskView>;
  locks: Record<string, LockView>;
  files: Record<string, FileView>;
  requests: Record<string, RequestView>;
  proposals: Record<string, ProposalView>;
  /** Newest first, at most FEED_MAX_ITEMS. */
  feed: FeedItem[];
  /** memberId → newest-first bob.activity items, at most BOB_ACTIVITY_MAX_ITEMS each. */
  bobActivity: Record<string, BobActivityItem[]>;
  /** Id of the last applied event. */
  cursor: number;
}

export function initialState(): RadarState {
  return {
    workspace: { id: '', name: '', headCommit: null, repoUrl: null },
    members: {},
    tasks: {},
    locks: {},
    files: {},
    requests: {},
    proposals: {},
    feed: [],
    bobActivity: {},
    cursor: 0,
  };
}

function defaultMember(id: string): MemberView {
  return {
    id,
    name: id,
    role: 'coder',
    color: (MEMBER_COLORS as Record<string, string>)[id] ?? null,
    online: false,
    stale: false,
    activeTaskId: null,
    blocked: false,
    writingUntil: 0,
  };
}

function patchMember(s: RadarState, id: string, patch: Partial<MemberView>): RadarState {
  const prev = s.members[id] ?? defaultMember(id);
  return { ...s, members: { ...s.members, [id]: { ...prev, ...patch } } };
}

function patchTask(s: RadarState, id: string, patch: (t: TaskView) => Partial<TaskView>): RadarState {
  const prev = s.tasks[id];
  if (!prev) return s;
  return { ...s, tasks: { ...s.tasks, [id]: { ...prev, ...patch(prev) } } };
}

function setLock(s: RadarState, lock: LockView): RadarState {
  return { ...s, locks: { ...s.locks, [lock.path]: lock } };
}

function dropLock(s: RadarState, path: string): RadarState {
  const locks = { ...s.locks };
  delete locks[path];
  return { ...s, locks };
}

/** Remove a finished or cancelled task from every queue (R4 §5 releaseTaskLocks renumbers silently). */
function dropFromQueues(s: RadarState, taskId: string): RadarState {
  let changed = false;
  const locks: Record<string, LockView> = {};
  for (const [path, lock] of Object.entries(s.locks)) {
    if (lock.queue.includes(taskId)) {
      changed = true;
      locks[path] = { ...lock, queue: lock.queue.filter((t) => t !== taskId) };
    } else {
      locks[path] = lock;
    }
  }
  return changed ? { ...s, locks } : s;
}

/** Release or revoke: the entry disappears only when nobody is queued; otherwise lock.transferred follows. */
function releaseLock(s: RadarState, path: string, taskId: string): RadarState {
  const lock = s.locks[path];
  if (!lock || lock.taskId !== taskId) return s;
  return lock.queue.length === 0 ? dropLock(s, path) : s;
}

function applyDomain(s: RadarState, ev: RadarEvent): RadarState {
  switch (ev.type) {
    case 'workspace.created': {
      const p = ev.payload;
      return {
        ...s,
        workspace: { ...s.workspace, id: p.workspaceId, name: s.workspace.name || p.workspaceId, headCommit: p.headCommit },
      };
    }
    case 'member.created': {
      const prev = s.members[ev.payload.memberId] ?? defaultMember(ev.payload.memberId);
      return patchMember(s, ev.payload.memberId, {
        name: ev.payload.name ?? prev.name,
        role: ev.payload.role ?? prev.role,
      });
    }
    case 'member.online':
    case 'member.reconnected':
      return patchMember(s, ev.payload.memberId, { online: true, stale: false });
    case 'member.offline':
      return patchMember(s, ev.payload.memberId, { online: false });
    case 'member.stale':
      return patchMember(s, ev.payload.memberId, { stale: true });

    case 'file.changed': {
      const p = ev.payload;
      const file: FileView = {
        path: p.path,
        version: p.version,
        updatedBy: p.by,
        updatedAt: ev.ts,
        writingUntil: ev.ts + WRITING_INDICATOR_MS,
        deleted: false,
      };
      const next = { ...s, files: { ...s.files, [p.path]: file } };
      return p.taskId ? patchTask(next, p.taskId, (t) => ({ editCount: t.editCount + 1 })) : next;
    }
    case 'file.deleted': {
      const p = ev.payload;
      const file: FileView = { path: p.path, version: p.version, updatedBy: p.by, updatedAt: ev.ts, writingUntil: 0, deleted: true };
      return { ...s, files: { ...s.files, [p.path]: file } };
    }

    case 'lock.reserved':
    case 'lock.acquired': {
      const p = ev.payload;
      const prev = s.locks[p.path];
      const next = setLock(s, {
        path: p.path,
        taskId: p.taskId,
        memberId: p.memberId,
        state: ev.type === 'lock.reserved' ? 'dipesan' : 'dipegang',
        queue: (prev?.queue ?? []).filter((t) => t !== p.taskId),
      });
      return ev.type === 'lock.acquired' ? patchMember(next, p.memberId, { activeTaskId: p.taskId }) : next;
    }
    case 'lock.review': {
      const lock = s.locks[ev.payload.path];
      return lock && lock.taskId === ev.payload.taskId ? setLock(s, { ...lock, state: 'review' }) : s;
    }
    case 'lock.released':
    case 'lock.revoked':
      return releaseLock(s, ev.payload.path, ev.payload.taskId);
    case 'lock.transferred': {
      const p = ev.payload;
      let queue = (s.locks[p.path]?.queue ?? []).filter((t) => t !== p.toTaskId);
      // 'pindahkan': the previous holder queues right behind the new one (R4 §5 transferNow).
      if (p.cause === 'decision' && p.fromTaskId && p.fromTaskId !== p.toTaskId) {
        queue = [p.fromTaskId, ...queue.filter((t) => t !== p.fromTaskId)];
      }
      return setLock(s, { path: p.path, taskId: p.toTaskId, memberId: p.toMemberId, state: 'dipesan', queue });
    }
    case 'lock.queued': {
      const p = ev.payload;
      const lock = s.locks[p.path];
      if (!lock || lock.taskId === p.taskId) return s;
      const queue = lock.queue.filter((t) => t !== p.taskId);
      // pos counts the holder as 0, so queue index = pos - 1.
      queue.splice(Math.min(Math.max(p.pos - 1, 0), queue.length), 0, p.taskId);
      return setLock(s, { ...lock, queue });
    }

    case 'task.created': {
      const p = ev.payload;
      const task: TaskView = {
        id: p.taskId,
        title: p.title,
        description: p.description ?? '',
        ownerId: p.ownerId,
        status: p.status,
        files: p.files,
        queuedFiles: p.queuedFiles,
        adhoc: p.adhoc,
        parentTaskId: p.parentTaskId ?? null,
        editCount: 0,
        commitSha: null,
        summary: null,
      };
      return { ...s, tasks: { ...s.tasks, [p.taskId]: task } };
    }
    case 'task.status': {
      const p = ev.payload;
      let next = patchTask(s, p.taskId, () => ({ status: p.to }));
      if (p.to === 'selesai' || p.to === 'batal') {
        next = dropFromQueues(next, p.taskId);
        const owner = next.tasks[p.taskId]?.ownerId;
        if (owner && next.members[owner]?.activeTaskId === p.taskId) {
          next = patchMember(next, owner, { activeTaskId: null });
        }
      }
      return next;
    }
    case 'task.submitted':
      return patchTask(s, ev.payload.taskId, () => ({ summary: ev.payload.summary }));

    case 'request.created': {
      const p = ev.payload;
      const req: RequestView = {
        id: p.requestId,
        path: p.path,
        status: 'terbuka',
        source: p.source,
        requesterMemberId: p.requesterMemberId,
        requesterTaskId: p.requesterTaskId,
        holderMemberId: p.holderMemberId,
        holderTaskId: p.holderTaskId,
        createdAt: ev.ts,
        outcome: null,
      };
      return { ...s, requests: { ...s.requests, [p.requestId]: req } };
    }
    case 'request.decided': {
      const req = s.requests[ev.payload.requestId];
      if (!req) return s;
      const status = ev.payload.outcome === 'ditolak' ? 'ditolak' : 'diputuskan';
      return { ...s, requests: { ...s.requests, [req.id]: { ...req, status, outcome: ev.payload.outcome } } };
    }

    case 'proposal.created': {
      const p = ev.payload;
      const proposal: ProposalView = {
        id: p.proposalId,
        kind: p.kind,
        status: 'menunggu',
        refId: p.refId,
        reason: p.reason,
        payload: p.payload,
        createdAt: ev.ts,
        decidedBy: null,
        note: null,
      };
      let next: RadarState = { ...s, proposals: { ...s.proposals, [p.proposalId]: proposal } };
      const requestId = p.kind === 'decision' ? requestIdOf(p.payload) : null;
      const req = requestId ? next.requests[requestId] : undefined;
      if (req && req.status === 'terbuka') {
        next = { ...next, requests: { ...next.requests, [req.id]: { ...req, status: 'diusulkan' } } };
      }
      return next;
    }
    case 'proposal.decided': {
      const prev = s.proposals[ev.payload.proposalId];
      if (!prev) return s;
      const proposal: ProposalView = { ...prev, status: ev.payload.status, decidedBy: ev.payload.by, note: ev.payload.note ?? null };
      return { ...s, proposals: { ...s.proposals, [prev.id]: proposal } };
    }

    case 'commit.created': {
      const next = patchTask(s, ev.payload.taskId, () => ({ commitSha: ev.payload.sha }));
      return { ...next, workspace: { ...next.workspace, headCommit: ev.payload.sha } };
    }

    case 'bob.activity': {
      const p = ev.payload;
      const item: BobActivityItem = { id: ev.id, ts: ev.ts, ...p };
      const list = [item, ...(s.bobActivity[p.memberId] ?? [])].slice(0, BOB_ACTIVITY_MAX_ITEMS);
      let next: RadarState = { ...s, bobActivity: { ...s.bobActivity, [p.memberId]: list } };
      if (p.kind === 'tool.pre' && p.decision) {
        next = patchMember(next, p.memberId, { blocked: p.decision === 'block' });
      } else if (p.kind === 'tool.post' && p.paths && p.paths.length > 0) {
        next = patchMember(next, p.memberId, { writingUntil: ev.ts + WRITING_INDICATOR_MS });
      }
      return next;
    }

    case 'file.rejected':
    case 'sync.applied':
    case 'lock.blocked':
    case 'hook.failopen':
    case 'review.created':
    case 'review.flagged':
    case 'notify.sent':
    case 'commit.push_failed':
    case 'ai.edit':
    case 'bob.turn':
    case 'bob.said':
      return s;
  }
}

function requestIdOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const id = (payload as { requestId?: unknown }).requestId;
  return typeof id === 'string' ? id : null;
}

function appendFeed(s: RadarState, ev: RadarEvent): RadarState {
  const text = feedText(ev);
  if (text === null) return s;
  const item: FeedItem = { id: ev.id, ts: ev.ts, type: ev.type, actor: ev.actor, text };
  return { ...s, feed: [item, ...s.feed].slice(0, FEED_MAX_ITEMS) };
}

/**
 * Apply one event. Events already covered by `state.cursor` are skipped, so a snapshot followed by
 * overlapping live events stays correct. Unknown event types only advance the cursor (forward-compatible).
 */
export function applyEvent(state: RadarState, ev: RadarEvent): RadarState {
  if (state.cursor > 0 && ev.id <= state.cursor) return state;
  const known = parseRadarEvent(ev);
  if (known === null) return typeof ev.id === 'number' ? { ...state, cursor: Math.max(state.cursor, ev.id) } : state;
  const next = appendFeed(applyDomain(state, known), known);
  return { ...next, cursor: Math.max(next.cursor, known.id) };
}

export function applyEvents(state: RadarState, evs: readonly RadarEvent[]): RadarState {
  let s = state;
  for (const ev of evs) s = applyEvent(s, ev);
  return s;
}

const byId = <T extends { id: string }>(items: readonly T[]): Record<string, T> =>
  Object.fromEntries(items.map((i) => [i.id, i]));

/**
 * Build RadarState from a `GET /v1/state` snapshot (or the WS `state` message). The snapshot already
 * contains the effect of `recentEvents`, so those only rebuild the feed and the Bob timelines.
 */
export function stateFromSnapshot(res: StateRes): RadarState {
  let s: RadarState = {
    workspace: res.workspace,
    members: byId(res.members),
    tasks: byId(res.tasks),
    locks: Object.fromEntries(res.locks.map((l) => [l.path, l])),
    files: Object.fromEntries(res.files.map((f) => [f.path, f])),
    requests: byId(res.requests),
    proposals: byId(res.proposals),
    feed: [],
    bobActivity: {},
    cursor: res.cursor,
  };
  const events = res.recentEvents
    .map(parseRadarEvent)
    .filter((e): e is RadarEvent => e !== null)
    .sort((a, b) => a.id - b.id);
  for (const ev of events) {
    s = appendFeed(s, ev);
    if (ev.type === 'bob.activity') {
      const item: BobActivityItem = { id: ev.id, ts: ev.ts, ...ev.payload };
      const list = [item, ...(s.bobActivity[ev.payload.memberId] ?? [])].slice(0, BOB_ACTIVITY_MAX_ITEMS);
      s = { ...s, bobActivity: { ...s.bobActivity, [ev.payload.memberId]: list } };
    }
  }
  return s;
}
