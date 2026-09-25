// TODO(sync:alief): temporary copy of the @radar/common view types (R3 §5, §6) — ganti dengan import dari @radar/common setelah fase 02 masuk main
// Keep this file shape-only (no logic) so the swap is a one-line re-export.

export type MemberId = string;
export type Role = 'coder' | 'pm';

export type LockState = 'bebas' | 'dipesan' | 'dipegang' | 'review';
export type TaskStatus = 'terbuka' | 'draf' | 'dikerjakan' | 'review' | 'selesai' | 'batal';
export type ProposalKind = 'plan' | 'decision' | 'review';
// TODO(sync:alief): deny status is not named in R3 §2.14; 'ditolak' assumed — ganti setelah fase 02 masuk main
export type ProposalStatus = 'menunggu' | 'disetujui' | 'ditolak' | 'diterapkan_otomatis';

export type BobActivityKind = 'prompt' | 'tool.pre' | 'tool.post' | 'turn.end' | 'session.start';

export interface MemberView {
  id: MemberId;
  name: string;
  role: Role;
  online: boolean;
  stale?: boolean;
  activeTaskId: string | null;
  blocked: boolean;
}

export interface TaskView {
  id: string;
  title: string;
  ownerId: MemberId;
  status: TaskStatus;
  files: string[];
  queuedFiles: string[];
  editCount: number;
  commitSha: string | null;
}

export interface LockView {
  path: string;
  taskId: string | null;
  memberId: MemberId | null;
  state: LockState;
  queue: string[];
}

export interface FileView {
  path: string;
  version: number;
  updatedBy: MemberId | null;
  updatedAt: number;
  writingUntil: number;
}

export interface RequestView {
  id: string;
  path: string;
  requesterMemberId: MemberId;
  requesterTaskId: string | null;
  holderMemberId: MemberId | null;
  holderTaskId: string | null;
  status: 'terbuka' | 'diputuskan';
}

export interface ProposalView {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  payload: Record<string, unknown>;
  reason: string;
  refId: string | null;
  createdAt: number;
  decidedBy?: string | null;
  note?: string | null;
}

export type FeedKind = 'edit' | 'blocked' | 'decision' | 'commit' | 'info';

export interface FeedItem {
  id: number;
  ts: number;
  actor: MemberId | 'mc' | 'server';
  kind: FeedKind;
  text: string;
  trace?: string;
}

export interface BobActivityItem {
  id: number;
  ts: number;
  memberId: MemberId;
  kind: BobActivityKind;
  sessionId: string;
  mode: string;
  tool?: string;
  paths?: string[];
  decision?: 'allow' | 'block';
  linesChanged?: number;
  text?: string;
}

export interface RadarState {
  workspace: { id: string; name: string; headCommit: string | null; repoUrl: string | null };
  members: Record<MemberId, MemberView>;
  tasks: Record<string, TaskView>;
  locks: Record<string, LockView>;
  files: Record<string, FileView>;
  requests: Record<string, RequestView>;
  proposals: Record<string, ProposalView>;
  feed: FeedItem[];
  bobActivity: Record<MemberId, BobActivityItem[]>;
  cursor: number;
}

export interface RadarEvent {
  id: number;
  ts: number;
  actor: string;
  type: string;
  payload: Record<string, unknown>;
}
