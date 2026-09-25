// Domain types (R2 enums, R3 §6 view objects). Status strings match the R2 CHECK constraints exactly.

export type MemberId = string;
export type TaskId = string;
export type Role = 'coder' | 'pm';

export type Principal = { kind: 'member'; memberId: MemberId; role: Role } | { kind: 'mc' };

export const TASK_STATUSES = ['draf', 'terbuka', 'dikerjakan', 'review', 'selesai', 'batal'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const LOCK_STATES = ['dipesan', 'dipegang', 'review'] as const;
export type LockState = (typeof LOCK_STATES)[number];
export type LockStateView = LockState | 'bebas';

export const ALLOCATION_SOURCES = ['plan', 'auto', 'decision'] as const;
export type AllocationSource = (typeof ALLOCATION_SOURCES)[number];

export const BLOCK_VIAS = ['hook', 'sync'] as const;
export type BlockVia = (typeof BLOCK_VIAS)[number];

export const REQUEST_SOURCES = ['hook', 'sync', 'mcp'] as const;
export type RequestSource = (typeof REQUEST_SOURCES)[number];

export const REQUEST_STATUSES = ['terbuka', 'diusulkan', 'diputuskan', 'ditolak', 'batal'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const PROPOSAL_KINDS = ['plan', 'decision', 'review'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const PROPOSAL_STATUSES = ['menunggu', 'disetujui', 'ditolak', 'diterapkan_otomatis', 'kedaluwarsa'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const REVIEW_VERDICTS = ['setujui', 'setujui_beri_tahu', 'kembalikan'] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export const DECISION_OPTIONS = ['antre', 'pindahkan', 'pecah'] as const;
export type DecisionOption = (typeof DECISION_OPTIONS)[number];

export const NOTIFICATION_KINDS = ['pm_note', 'decision', 'lock', 'review', 'system'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const CHECK_REASONS = [
  'own',
  'grabbed',
  'held_by_other',
  'reserved_by_other',
  'in_review_by_other',
  'committing',
  'pm_readonly',
  'ignored_path',
] as const;
export type CheckReason = (typeof CHECK_REASONS)[number];

export type Decision = 'allow' | 'block';

export const BOB_ACTIVITY_KINDS = ['session.start', 'prompt', 'tool.pre', 'tool.post', 'turn.end'] as const;
export type BobActivityKind = (typeof BOB_ACTIVITY_KINDS)[number];

export type MemberStatus = 'idle' | 'writing' | 'blocked';

// ---- View objects held by RadarState (R3 §6) ---------------------------------------------------------------

export interface WorkspaceView {
  id: string;
  name: string;
  headCommit: string | null;
  repoUrl: string | null;
}

export interface MemberView {
  id: MemberId;
  name: string;
  role: Role;
  color: string | null;
  online: boolean;
  stale: boolean;
  activeTaskId: TaskId | null;
  /** Set by a blocked `tool.pre` bob.activity, cleared by the next allowed one (R3 §6). */
  blocked: boolean;
  /** Epoch ms until which a `tool.post` with paths counts as "writing" (R3 §6). */
  writingUntil: number;
}

export interface TaskView {
  id: TaskId;
  title: string;
  description: string;
  ownerId: MemberId;
  status: TaskStatus;
  files: string[];
  queuedFiles: string[];
  adhoc: boolean;
  parentTaskId: TaskId | null;
  editCount: number;
  commitSha: string | null;
  summary: string | null;
}

export interface LockView {
  path: string;
  taskId: TaskId;
  memberId: MemberId;
  state: LockState;
  /** Task ids waiting for this path, in queue order. */
  queue: TaskId[];
}

export interface FileView {
  path: string;
  version: number;
  updatedBy: MemberId | null;
  updatedAt: number;
  writingUntil: number;
  deleted: boolean;
}

export interface RequestView {
  id: string;
  path: string;
  status: RequestStatus;
  source: RequestSource;
  requesterMemberId: MemberId;
  requesterTaskId: TaskId | null;
  holderMemberId: MemberId | null;
  holderTaskId: TaskId | null;
  createdAt: number;
  outcome: string | null;
}

export interface ProposalView {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  refId: string | null;
  reason: string;
  payload: unknown;
  createdAt: number;
  decidedBy: string | null;
  note: string | null;
}

export interface FeedItem {
  id: number;
  ts: number;
  type: string;
  actor: string;
  text: string;
}

export interface BobActivityItem {
  id: number;
  ts: number;
  memberId: MemberId;
  kind: BobActivityKind;
  sessionId: string | null;
  mode: string;
  tool?: string | undefined;
  paths?: string[] | undefined;
  decision?: Decision | undefined;
  linesChanged?: number | undefined;
  text?: string | undefined;
}
