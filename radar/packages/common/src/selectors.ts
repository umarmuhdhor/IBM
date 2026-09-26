// Read-only views over RadarState for Mission Control, the desktop app and the replay.
import type { RadarState } from './reducer.js';
import { PlanPayload } from './schemas.js';
import type { BobActivityItem, LockStateView, LockView, MemberStatus, ProposalView, TaskView } from './types.js';

/** Natural order for ids like T-2 < T-10. */
export function compareIds(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

export interface DraftTaskCard {
  proposalId: string;
  ref: string;
  title: string;
  ownerId: string;
  files: string[];
  queuedFiles: string[];
}

export interface TaskColumns {
  /** Tasks inside plan proposals that still wait for the PM (R4 §2: drafts live only in the proposal). */
  draf: DraftTaskCard[];
  /** `terbuka` and `dikerjakan`. */
  dikerjakan: TaskView[];
  review: TaskView[];
  selesai: TaskView[];
}

export function tasksByColumn(state: RadarState): TaskColumns {
  const cols: TaskColumns = { draf: [], dikerjakan: [], review: [], selesai: [] };
  for (const p of pendingDecisions(state)) {
    if (p.kind !== 'plan') continue;
    const plan = PlanPayload.safeParse(p.payload);
    if (!plan.success) continue;
    for (const t of plan.data.tasks) {
      cols.draf.push({ proposalId: p.id, ref: t.ref, title: t.title, ownerId: t.ownerId, files: t.files, queuedFiles: t.queuedFiles });
    }
  }
  const tasks = Object.values(state.tasks).sort((a, b) => compareIds(a.id, b.id));
  for (const t of tasks) {
    if (t.status === 'terbuka' || t.status === 'dikerjakan') cols.dikerjakan.push(t);
    else if (t.status === 'review') cols.review.push(t);
    else if (t.status === 'selesai') cols.selesai.push(t);
  }
  return cols;
}

/** Proposals waiting for Mission Control, oldest first. */
export function pendingDecisions(state: RadarState): ProposalView[] {
  return Object.values(state.proposals)
    .filter((p) => p.status === 'menunggu')
    .sort((a, b) => a.createdAt - b.createdAt || compareIds(a.id, b.id));
}

/**
 * "Needs you" badge: proposals waiting for approval plus stale members that still hold a lock
 * (SV-09, the PM may revoke).
 */
export function needsYouCount(state: RadarState): number {
  const holders = new Set(Object.values(state.locks).map((l) => l.memberId));
  const staleHolders = Object.values(state.members).filter((m) => m.stale && holders.has(m.id)).length;
  return pendingDecisions(state).length + staleHolders;
}

/** Status dot in the Team panel. `now` is passed in so the selector stays pure. */
export function memberStatus(state: RadarState, memberId: string, now: number): MemberStatus {
  const m = state.members[memberId];
  if (!m) return 'idle';
  if (m.blocked) return 'blocked';
  if (now < m.writingUntil) return 'writing';
  for (const f of Object.values(state.files)) {
    if (f.updatedBy === memberId && now < f.writingUntil) return 'writing';
  }
  return 'idle';
}

/** Watch Bob timeline (fase 11): the member's bob.activity items, oldest first. */
export function bobTimeline(state: RadarState, memberId: string): BobActivityItem[] {
  return [...(state.bobActivity[memberId] ?? [])].reverse();
}

export interface FileTreeNode {
  name: string;
  /** Workspace-relative path; '' for the root. */
  path: string;
  kind: 'dir' | 'file';
  children: FileTreeNode[];
  lock: LockView | null;
  lockState: LockStateView;
  version: number | null;
}

/** Folder tree of every known (not deleted) file plus every locked path, directories first. */
export function fileTree(state: RadarState): FileTreeNode {
  const root: FileTreeNode = { name: '', path: '', kind: 'dir', children: [], lock: null, lockState: 'bebas', version: null };
  const paths = new Set<string>([
    ...Object.values(state.files).filter((f) => !f.deleted).map((f) => f.path),
    ...Object.keys(state.locks),
  ]);
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    parts.forEach((name, i) => {
      const isFile = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join('/');
      let child = node.children.find((c) => c.name === name && c.kind === (isFile ? 'file' : 'dir'));
      if (!child) {
        const lock = isFile ? (state.locks[path] ?? null) : null;
        child = {
          name,
          path: childPath,
          kind: isFile ? 'file' : 'dir',
          children: [],
          lock,
          lockState: lock ? lock.state : 'bebas',
          version: isFile ? (state.files[path]?.version ?? null) : null,
        };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sortRec = (n: FileTreeNode) => {
    n.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1));
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}
