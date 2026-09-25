// zod schemas for every REST body (R3 §2), proposal payload (R3 §4), WebSocket message (R3 §3) and event (R3 §5).
// Server, sync, hooks, radar-mcp and the UI all import these, so a shape can only change here.
import { z } from 'zod';
import {
  ACTIVITY_TEXT_MAX_CHARS,
  NOTIFY_MAX_CHARS,
  PLAN_MAX_FILES_PER_TASK,
  PLAN_MAX_TASKS,
  SUBMIT_SUMMARY_MAX_CHARS,
} from './constants.js';
import {
  ALLOCATION_SOURCES,
  BLOCK_VIAS,
  CHECK_REASONS,
  DECISION_OPTIONS,
  LOCK_STATES,
  PROPOSAL_KINDS,
  PROPOSAL_STATUSES,
  REQUEST_SOURCES,
  REQUEST_STATUSES,
  REVIEW_VERDICTS,
  TASK_STATUSES,
} from './types.js';

// ---- Primitives ----------------------------------------------------------------------------------------------

export const PathSchema = z.string().min(1).max(1024);
export const MemberIdSchema = z.string().min(1).max(64);
export const TaskIdSchema = z.string().min(1).max(64);
export const EpochMsSchema = z.number().int().nonnegative();

export const RoleSchema = z.enum(['coder', 'pm']);
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export const LockStateSchema = z.enum(LOCK_STATES);
export const LockStateViewSchema = z.enum([...LOCK_STATES, 'bebas']);
export const AllocationSourceSchema = z.enum(ALLOCATION_SOURCES);
export const BlockViaSchema = z.enum(BLOCK_VIAS);
export const RequestSourceSchema = z.enum(REQUEST_SOURCES);
export const RequestStatusSchema = z.enum(REQUEST_STATUSES);
export const ProposalKindSchema = z.enum(PROPOSAL_KINDS);
export const ProposalStatusSchema = z.enum(PROPOSAL_STATUSES);
export const ReviewVerdictSchema = z.enum(REVIEW_VERDICTS);
export const DecisionOptionSchema = z.enum(DECISION_OPTIONS);
export const CheckReasonSchema = z.enum(CHECK_REASONS);
export const DecisionSchema = z.enum(['allow', 'block']);

export const PrincipalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('member'), memberId: MemberIdSchema, role: RoleSchema }),
  z.object({ kind: z.literal('mc') }),
]);

// ---- Errors (R3 §1, §3.9) ------------------------------------------------------------------------------------

export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION',
  'INTERNAL',
  'TERM_NOT_FOUND',
  'TERM_NOT_OWNER',
  'TERM_NO_GRANT',
  'TERM_FRAME_TOO_LARGE',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorRes = z.object({ error: z.object({ code: ErrorCodeSchema, message: z.string() }) });
export type ErrorRes = z.infer<typeof ErrorRes>;

// ---- 2.1 healthz ---------------------------------------------------------------------------------------------

export const HealthRes = z.object({
  ok: z.boolean(),
  workspace: z.string(),
  version: z.string(),
  uptimeMs: z.number().nonnegative(),
});
export type HealthRes = z.infer<typeof HealthRes>;

// ---- 2.2 locks/check -----------------------------------------------------------------------------------------

export const LockHolder = z.object({
  memberId: MemberIdSchema,
  memberName: z.string(),
  taskId: TaskIdSchema,
  taskTitle: z.string(),
  state: LockStateSchema,
  sinceMs: z.number().nonnegative().optional(),
});
export type LockHolder = z.infer<typeof LockHolder>;

export const LockCheckReq = z.object({
  paths: z.array(PathSchema).min(1).max(100),
  tool: z.string().min(1).max(128),
  sessionId: z.string().max(256).nullable().optional(),
  clientTs: EpochMsSchema,
});
export type LockCheckReq = z.infer<typeof LockCheckReq>;

export const LockCheckResult = z.object({
  path: PathSchema,
  decision: DecisionSchema,
  reason: CheckReasonSchema,
  holder: LockHolder.nullable().optional(),
  requestId: z.string().nullable().optional(),
  queuePos: z.number().int().nonnegative().nullable().optional(),
});
export type LockCheckResult = z.infer<typeof LockCheckResult>;

export const LockCheckRes = z.object({
  decision: DecisionSchema,
  results: z.array(LockCheckResult),
  activeTaskId: TaskIdSchema.nullable(),
  message: z.string(),
  serverMs: z.number().nonnegative().optional(),
});
export type LockCheckRes = z.infer<typeof LockCheckRes>;

// ---- 2.3 brief -----------------------------------------------------------------------------------------------

export const BriefQuery = z.object({
  kind: z.enum(['start', 'prompt']),
  since: z.coerce.number().int().nonnegative().optional(),
  peek: z.enum(['true', 'false']).optional(),
});
export type BriefQuery = z.infer<typeof BriefQuery>;

export const BriefRes = z.object({ lines: z.array(z.string()), cursor: z.number().int().nonnegative() });
export type BriefRes = z.infer<typeof BriefRes>;

// ---- 2.4 tasks / 2.5 activate --------------------------------------------------------------------------------

export const TaskFileEntry = z.object({
  path: PathSchema,
  lock: LockStateSchema.nullable(),
  queuePos: z.number().int().nonnegative().nullable(),
  waitingFor: TaskIdSchema.nullable().optional(),
});
export type TaskFileEntry = z.infer<typeof TaskFileEntry>;

export const TaskItem = z.object({
  id: TaskIdSchema,
  title: z.string(),
  description: z.string(),
  ownerId: MemberIdSchema,
  status: TaskStatusSchema,
  adhoc: z.boolean(),
  baseCommit: z.string().nullable(),
  editCount: z.number().int().nonnegative(),
  files: z.array(TaskFileEntry),
});
export type TaskItem = z.infer<typeof TaskItem>;

export const TasksQuery = z.object({
  owner: z.string().optional(),
  status: z.enum(['open', 'all']).optional(),
});
export type TasksQuery = z.infer<typeof TasksQuery>;

export const TasksRes = z.object({ tasks: z.array(TaskItem), activeTaskId: TaskIdSchema.nullable() });
export type TasksRes = z.infer<typeof TasksRes>;

export const ActivateRes = z.object({ activeTaskId: TaskIdSchema });
export type ActivateRes = z.infer<typeof ActivateRes>;

// ---- 2.6 blocks/last -----------------------------------------------------------------------------------------

export const BlockLastRes = z.object({
  block: z
    .object({
      path: PathSchema,
      ts: EpochMsSchema,
      via: BlockViaSchema,
      holder: LockHolder.nullable(),
      requestId: z.string().nullable(),
      requestStatus: RequestStatusSchema.nullable(),
      queue: z.array(z.object({ taskId: TaskIdSchema, memberId: MemberIdSchema })),
      suggestion: z.string(),
    })
    .nullable(),
});
export type BlockLastRes = z.infer<typeof BlockLastRes>;

// ---- 2.7 requests (create) -----------------------------------------------------------------------------------

export const RequestFileReq = z.object({ path: PathSchema, reason: z.string().max(500).default('') });
export type RequestFileReq = z.infer<typeof RequestFileReq>;

export const RequestFileRes = z.union([
  z.object({ requestId: z.string(), status: RequestStatusSchema, duplicate: z.boolean() }),
  z.object({ requestId: z.null(), status: z.literal('bebas'), message: z.string() }),
]);
export type RequestFileRes = z.infer<typeof RequestFileRes>;

// ---- 2.8 activity --------------------------------------------------------------------------------------------

export const ActivityQuery = z.object({
  path: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type ActivityQuery = z.infer<typeof ActivityQuery>;

export const ActivityRes = z.object({
  items: z.array(
    z.object({
      ts: EpochMsSchema,
      actor: z.string(),
      type: z.string(),
      path: PathSchema.optional(),
      summary: z.string(),
    }),
  ),
});
export type ActivityRes = z.infer<typeof ActivityRes>;

// ---- 2.9 submit ----------------------------------------------------------------------------------------------

export const SubmitReq = z.object({ summary: z.string().min(1).max(SUBMIT_SUMMARY_MAX_CHARS) });
export type SubmitReq = z.infer<typeof SubmitReq>;

export const SubmitRes = z.object({ taskId: TaskIdSchema, status: z.literal('review'), files: z.array(PathSchema) });
export type SubmitRes = z.infer<typeof SubmitRes>;

// ---- 2.10 team -----------------------------------------------------------------------------------------------

export const TeamRes = z.object({
  members: z.array(
    z.object({
      id: MemberIdSchema,
      name: z.string(),
      role: RoleSchema,
      online: z.boolean(),
      lastHeartbeatMs: z.number().nonnegative().nullable(),
      activeTaskId: TaskIdSchema.nullable(),
    }),
  ),
  tasks: z.array(
    z.object({
      id: TaskIdSchema,
      title: z.string(),
      ownerId: MemberIdSchema,
      status: TaskStatusSchema,
      files: z.array(PathSchema),
      editCount: z.number().int().nonnegative(),
    }),
  ),
  locks: z.array(
    z.object({
      path: PathSchema,
      taskId: TaskIdSchema,
      memberId: MemberIdSchema,
      state: LockStateSchema,
      queue: z.array(TaskIdSchema),
    }),
  ),
  openRequests: z.number().int().nonnegative(),
  pendingProposals: z.number().int().nonnegative(),
  headCommit: z.string().nullable(),
});
export type TeamRes = z.infer<typeof TeamRes>;

// ---- 2.11 requests (list) ------------------------------------------------------------------------------------

export const RequestsQuery = z.object({ status: z.enum(['terbuka', 'diusulkan', 'all']).optional() });
export type RequestsQuery = z.infer<typeof RequestsQuery>;

export const RequestItem = z.object({
  id: z.string(),
  path: PathSchema,
  status: RequestStatusSchema,
  source: RequestSourceSchema,
  reason: z.string(),
  requester: z.object({
    memberId: MemberIdSchema,
    taskId: TaskIdSchema.nullable(),
    taskTitle: z.string(),
    taskDescription: z.string(),
  }),
  holder: z
    .object({
      memberId: MemberIdSchema,
      taskId: TaskIdSchema,
      taskTitle: z.string(),
      taskDescription: z.string(),
      state: LockStateSchema,
      editCount: z.number().int().nonnegative(),
    })
    .nullable(),
  fileVersion: z.number().int().nonnegative(),
  createdAt: EpochMsSchema,
});
export type RequestItem = z.infer<typeof RequestItem>;

export const RequestsRes = z.object({ requests: z.array(RequestItem) });
export type RequestsRes = z.infer<typeof RequestsRes>;

// ---- 4. Proposal payloads ------------------------------------------------------------------------------------

export const PlanTask = z.object({
  ref: z.string().min(1).max(32),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  ownerId: MemberIdSchema,
  files: z.array(PathSchema).max(PLAN_MAX_FILES_PER_TASK),
  queuedFiles: z.array(PathSchema).max(PLAN_MAX_FILES_PER_TASK).default([]),
});
export type PlanTask = z.infer<typeof PlanTask>;

/**
 * Shape rules only. Rules that need server state (owner must be a coder, path normalisation against the
 * workspace) are checked by the server (R3 §4.1).
 */
export const PlanPayload = z
  .object({
    goal: z.string().min(1).max(500),
    tasks: z.array(PlanTask).min(1).max(PLAN_MAX_TASKS),
  })
  .superRefine((plan, ctx) => {
    const owners = new Map<string, number>();
    plan.tasks.forEach((task, i) => {
      for (const path of task.files) {
        const prev = owners.get(path);
        if (prev !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['tasks', i, 'files'],
            message: `${path} is in files of task ${prev} and task ${i}; use queuedFiles for the later task`,
          });
        } else {
          owners.set(path, i);
        }
      }
    });
    plan.tasks.forEach((task, i) => {
      for (const path of task.queuedFiles) {
        const owner = owners.get(path);
        if (owner === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['tasks', i, 'queuedFiles'],
            message: `${path} is queued but no task has it in files`,
          });
        } else if (owner === i) {
          ctx.addIssue({
            code: 'custom',
            path: ['tasks', i, 'queuedFiles'],
            message: `${path} is both in files and queuedFiles of task ${i}`,
          });
        }
      }
    });
    const refs = new Set<string>();
    plan.tasks.forEach((task, i) => {
      if (refs.has(task.ref)) {
        ctx.addIssue({ code: 'custom', path: ['tasks', i, 'ref'], message: `duplicate ref ${task.ref}` });
      }
      refs.add(task.ref);
    });
  });
export type PlanPayload = z.infer<typeof PlanPayload>;

export const NewTask = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  ownerId: MemberIdSchema.optional(),
});
export type NewTask = z.infer<typeof NewTask>;

export const DecisionPayload = z
  .object({
    requestId: z.string().min(1),
    option: DecisionOptionSchema,
    newTask: NewTask.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.option === 'pecah' && !d.newTask) {
      ctx.addIssue({ code: 'custom', path: ['newTask'], message: 'newTask is required when option is pecah' });
    }
  });
export type DecisionPayload = z.infer<typeof DecisionPayload>;

export const ReviewPayload = z.object({
  taskId: TaskIdSchema,
  verdict: ReviewVerdictSchema,
  notes: z.string().max(2000).default(''),
  notify: z
    .array(z.object({ memberId: MemberIdSchema, message: z.string().min(1).max(NOTIFY_MAX_CHARS) }))
    .default([]),
  flags: z.array(z.object({ path: PathSchema, issue: z.string().min(1).max(500) })).default([]),
});
export type ReviewPayload = z.infer<typeof ReviewPayload>;

// ---- 2.12–2.14 proposals -------------------------------------------------------------------------------------

const ProposalReason = z.string().min(1).max(500);

export const ProposalCreateReq = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('plan'), payload: PlanPayload, reason: ProposalReason }),
  z.object({ kind: z.literal('decision'), payload: DecisionPayload, reason: ProposalReason }),
  z.object({ kind: z.literal('review'), payload: ReviewPayload, reason: ProposalReason }),
]);
export type ProposalCreateReq = z.infer<typeof ProposalCreateReq>;

export const ProposalCreateRes = z.object({
  proposalId: z.string(),
  status: z.enum(['menunggu', 'diterapkan_otomatis']),
});
export type ProposalCreateRes = z.infer<typeof ProposalCreateRes>;

export const ProposalItem = z.object({
  id: z.string(),
  kind: ProposalKindSchema,
  status: ProposalStatusSchema,
  payload: z.unknown(),
  reason: z.string(),
  refId: z.string().nullable(),
  createdAt: EpochMsSchema,
});
export type ProposalItem = z.infer<typeof ProposalItem>;

export const ProposalsQuery = z.object({ status: z.union([ProposalStatusSchema, z.literal('all')]).optional() });
export type ProposalsQuery = z.infer<typeof ProposalsQuery>;

export const ProposalsRes = z.object({ proposals: z.array(ProposalItem) });
export type ProposalsRes = z.infer<typeof ProposalsRes>;

export const DecisionReq = z.object({ approve: z.boolean(), note: z.string().max(500).optional() });
export type DecisionReq = z.infer<typeof DecisionReq>;

export const DecisionRes = z.object({
  proposalId: z.string(),
  status: ProposalStatusSchema,
  applied: z.record(z.string(), z.unknown()).optional(),
});
export type DecisionRes = z.infer<typeof DecisionRes>;

// ---- 2.15 task diff ------------------------------------------------------------------------------------------

export const TaskDiffRes = z.object({
  taskId: TaskIdSchema,
  title: z.string(),
  ownerId: MemberIdSchema,
  status: TaskStatusSchema,
  baseCommit: z.string().nullable(),
  summary: z.string().nullable(),
  files: z.array(
    z.object({
      path: PathSchema,
      change: z.enum(['added', 'modified', 'deleted']),
      fromVersion: z.number().int().nonnegative(),
      toVersion: z.number().int().nonnegative(),
      patch: z.string(),
      exportsChanged: z
        .array(z.object({ name: z.string(), kind: z.string(), before: z.string(), after: z.string() }))
        .default([]),
    }),
  ),
  importers: z
    .array(
      z.object({
        path: PathSchema,
        imports: PathSchema,
        symbols: z.array(z.string()),
        lines: z.array(z.number().int().positive()),
        holder: z
          .object({ memberId: MemberIdSchema, taskId: TaskIdSchema, state: LockStateSchema })
          .nullable(),
      }),
    )
    .default([]),
  truncated: z.boolean(),
});
export type TaskDiffRes = z.infer<typeof TaskDiffRes>;

// ---- 2.16 notify / 2.17 report -------------------------------------------------------------------------------

export const NotifyReq = z.object({ memberId: MemberIdSchema, message: z.string().min(1).max(NOTIFY_MAX_CHARS) });
export type NotifyReq = z.infer<typeof NotifyReq>;

export const NotifyRes = z.object({ notificationId: z.number().int().nonnegative() });
export type NotifyRes = z.infer<typeof NotifyRes>;

export const SessionReportRes = z.object({
  markdown: z.string(),
  stats: z.object({
    tasks: z.number().int().nonnegative(),
    commits: z.number().int().nonnegative(),
    blocks: z.number().int().nonnegative(),
    decisions: z.number().int().nonnegative(),
    medianBlockToDecisionMs: z.number().nonnegative().nullable(),
    syncP95Ms: z.number().nonnegative().nullable(),
    lockCheckP95Ms: z.number().nonnegative().nullable(),
  }),
});
export type SessionReportRes = z.infer<typeof SessionReportRes>;

// ---- 2.18 revoke / 2.19 cancel / 2.20 ai-edits ---------------------------------------------------------------

export const RevokeReq = z.object({ path: PathSchema, reason: z.string().min(1).max(500) });
export type RevokeReq = z.infer<typeof RevokeReq>;

export const RevokeRes = z.object({
  path: PathSchema,
  nextHolder: z.object({ taskId: TaskIdSchema, memberId: MemberIdSchema }).nullable(),
});
export type RevokeRes = z.infer<typeof RevokeRes>;

export const CancelRes = z.object({ taskId: TaskIdSchema, status: z.literal('batal') });
export type CancelRes = z.infer<typeof CancelRes>;

export const AiEditsReq = z.object({
  paths: z.array(PathSchema).min(1).max(100),
  tool: z.string().min(1).max(128),
  sessionId: z.string().max(256).nullable().optional(),
});
export type AiEditsReq = z.infer<typeof AiEditsReq>;

// ---- 2.21 state (snapshot) -----------------------------------------------------------------------------------
// Arrays on the wire; `stateFromSnapshot` (reducer.ts) turns them into the keyed RadarState.

export const WorkspaceViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  headCommit: z.string().nullable(),
  repoUrl: z.string().nullable(),
});

export const MemberViewSchema = z.object({
  id: MemberIdSchema,
  name: z.string(),
  role: RoleSchema,
  color: z.string().nullable().default(null),
  online: z.boolean(),
  stale: z.boolean().default(false),
  activeTaskId: TaskIdSchema.nullable(),
  blocked: z.boolean().default(false),
  writingUntil: z.number().nonnegative().default(0),
});

export const TaskViewSchema = z.object({
  id: TaskIdSchema,
  title: z.string(),
  description: z.string().default(''),
  ownerId: MemberIdSchema,
  status: TaskStatusSchema,
  files: z.array(PathSchema),
  queuedFiles: z.array(PathSchema).default([]),
  adhoc: z.boolean().default(false),
  parentTaskId: TaskIdSchema.nullable().default(null),
  editCount: z.number().int().nonnegative(),
  commitSha: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),
});

export const LockViewSchema = z.object({
  path: PathSchema,
  taskId: TaskIdSchema,
  memberId: MemberIdSchema,
  state: LockStateSchema,
  queue: z.array(TaskIdSchema),
});

export const AllocationViewSchema = z.object({
  taskId: TaskIdSchema,
  path: PathSchema,
  queuePos: z.number().int().nonnegative(),
  source: AllocationSourceSchema,
});

export const FileViewSchema = z.object({
  path: PathSchema,
  version: z.number().int().nonnegative(),
  updatedBy: MemberIdSchema.nullable(),
  updatedAt: EpochMsSchema,
  writingUntil: z.number().nonnegative().default(0),
  deleted: z.boolean().default(false),
});

export const RequestViewSchema = z.object({
  id: z.string(),
  path: PathSchema,
  status: RequestStatusSchema,
  source: RequestSourceSchema,
  requesterMemberId: MemberIdSchema,
  requesterTaskId: TaskIdSchema.nullable(),
  holderMemberId: MemberIdSchema.nullable(),
  holderTaskId: TaskIdSchema.nullable(),
  createdAt: EpochMsSchema,
  outcome: z.string().nullable().default(null),
});

export const ProposalViewSchema = z.object({
  id: z.string(),
  kind: ProposalKindSchema,
  status: ProposalStatusSchema,
  refId: z.string().nullable(),
  reason: z.string(),
  payload: z.unknown(),
  createdAt: EpochMsSchema,
  decidedBy: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
});

// ---- 5. Events -----------------------------------------------------------------------------------------------

const event = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.object({
    id: z.number().int().nonnegative(),
    ts: EpochMsSchema,
    actor: z.string(),
    type: z.literal(type),
    payload,
  });

const memberOnly = z.object({ memberId: MemberIdSchema });

export const BobActivityPayload = z.object({
  memberId: MemberIdSchema,
  kind: z.enum(['session.start', 'prompt', 'tool.pre', 'tool.post', 'turn.end']),
  sessionId: z.string().nullable(),
  mode: z.string(),
  tool: z.string().optional(),
  paths: z.array(PathSchema).optional(),
  decision: DecisionSchema.optional(),
  linesChanged: z.number().int().nonnegative().optional(),
  text: z.string().max(ACTIVITY_TEXT_MAX_CHARS).optional(),
});
export type BobActivityPayload = z.infer<typeof BobActivityPayload>;

export const RadarEventSchema = z.discriminatedUnion('type', [
  event('workspace.created', z.object({ workspaceId: z.string(), headCommit: z.string().nullable(), fileCount: z.number().int().nonnegative() })),
  event('member.created', memberOnly.extend({ name: z.string().optional(), role: RoleSchema.optional() })),
  event('member.online', memberOnly),
  event('member.offline', memberOnly),
  event('member.reconnected', memberOnly),
  event('member.stale', memberOnly.extend({ lastHeartbeat: EpochMsSchema.nullable() })),
  event(
    'file.changed',
    z.object({
      path: PathSchema,
      version: z.number().int().nonnegative(),
      hash: z.string(),
      by: MemberIdSchema,
      taskId: TaskIdSchema.nullable(),
      size: z.number().int().nonnegative(),
      patch: z.string().optional(),
    }),
  ),
  event('file.deleted', z.object({ path: PathSchema, version: z.number().int().nonnegative(), by: MemberIdSchema, taskId: TaskIdSchema.nullable() })),
  event(
    'file.rejected',
    z.object({
      path: PathSchema,
      by: MemberIdSchema,
      reason: z.string(),
      holderMemberId: MemberIdSchema.nullable(),
      holderTaskId: TaskIdSchema.nullable(),
    }),
  ),
  event('sync.applied', z.object({ path: PathSchema, version: z.number().int().nonnegative(), memberId: MemberIdSchema, latencyMs: z.number() })),
  event('lock.reserved', z.object({ path: PathSchema, taskId: TaskIdSchema, memberId: MemberIdSchema, source: AllocationSourceSchema })),
  event('lock.acquired', z.object({ path: PathSchema, taskId: TaskIdSchema, memberId: MemberIdSchema, auto: z.boolean() })),
  event('lock.review', z.object({ path: PathSchema, taskId: TaskIdSchema })),
  event('lock.released', z.object({ path: PathSchema, taskId: TaskIdSchema })),
  event(
    'lock.transferred',
    z.object({
      path: PathSchema,
      fromTaskId: TaskIdSchema.nullable().optional(),
      toTaskId: TaskIdSchema,
      toMemberId: MemberIdSchema,
      cause: z.enum(['queue', 'decision']),
    }),
  ),
  event('lock.queued', z.object({ path: PathSchema, taskId: TaskIdSchema, memberId: MemberIdSchema, pos: z.number().int().nonnegative() })),
  event('lock.revoked', z.object({ path: PathSchema, taskId: TaskIdSchema, memberId: MemberIdSchema, reason: z.string() })),
  event(
    'lock.blocked',
    z.object({
      path: PathSchema,
      memberId: MemberIdSchema,
      taskId: TaskIdSchema.nullable(),
      holderMemberId: MemberIdSchema,
      holderTaskId: TaskIdSchema,
      via: BlockViaSchema,
      requestId: z.string().nullable(),
    }),
  ),
  event('hook.failopen', z.object({ memberId: MemberIdSchema, paths: z.array(PathSchema), errorKind: z.string() })),
  event(
    'task.created',
    z.object({
      taskId: TaskIdSchema,
      title: z.string(),
      description: z.string().optional(),
      ownerId: MemberIdSchema,
      status: TaskStatusSchema,
      files: z.array(PathSchema),
      queuedFiles: z.array(PathSchema).default([]),
      adhoc: z.boolean(),
      parentTaskId: TaskIdSchema.nullable().optional(),
    }),
  ),
  event('task.status', z.object({ taskId: TaskIdSchema, from: TaskStatusSchema, to: TaskStatusSchema, by: z.string() })),
  event('task.submitted', z.object({ taskId: TaskIdSchema, summary: z.string(), files: z.array(PathSchema) })),
  event(
    'request.created',
    z.object({
      requestId: z.string(),
      path: PathSchema,
      requesterMemberId: MemberIdSchema,
      requesterTaskId: TaskIdSchema.nullable(),
      holderMemberId: MemberIdSchema.nullable(),
      holderTaskId: TaskIdSchema.nullable(),
      source: RequestSourceSchema,
    }),
  ),
  event(
    'request.decided',
    z.object({
      requestId: z.string(),
      outcome: z.union([DecisionOptionSchema, z.literal('ditolak')]),
      proposalId: z.string().nullable(),
      auto: z.boolean(),
    }),
  ),
  event(
    'proposal.created',
    z.object({ proposalId: z.string(), kind: ProposalKindSchema, refId: z.string().nullable(), reason: z.string(), payload: z.unknown() }),
  ),
  event(
    'proposal.decided',
    z.object({ proposalId: z.string(), kind: ProposalKindSchema, status: ProposalStatusSchema, by: z.string(), note: z.string().nullable().optional() }),
  ),
  event('review.created', z.object({ reviewId: z.union([z.string(), z.number()]), taskId: TaskIdSchema, verdict: ReviewVerdictSchema })),
  event(
    'review.flagged',
    z.object({
      reviewId: z.union([z.string(), z.number()]),
      taskId: TaskIdSchema,
      flags: z.array(z.object({ path: PathSchema, issue: z.string() })),
    }),
  ),
  event('notify.sent', z.object({ notificationId: z.number().int().nonnegative(), memberId: MemberIdSchema, message: z.string(), by: z.string() })),
  event(
    'commit.created',
    z.object({ taskId: TaskIdSchema, sha: z.string(), author: z.string(), files: z.array(PathSchema), pushed: z.boolean(), url: z.string().optional() }),
  ),
  event('commit.push_failed', z.object({ taskId: TaskIdSchema, sha: z.string().nullable(), error: z.string() })),
  event('bob.activity', BobActivityPayload),
  event('ai.edit', z.object({ memberId: MemberIdSchema, paths: z.array(PathSchema), tool: z.string() })),
  event('bob.turn', memberOnly),
  event('bob.said', memberOnly.extend({ text: z.string() })),
]);
export type RadarEvent = z.infer<typeof RadarEventSchema>;
export type RadarEventType = RadarEvent['type'];
export type RadarEventOf<T extends RadarEventType> = Extract<RadarEvent, { type: T }>;

/** Forward-compatible parse: unknown or malformed events return null instead of throwing (R3 §6). */
export function parseRadarEvent(raw: unknown): RadarEvent | null {
  const r = RadarEventSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export const StateRes = z.object({
  workspace: WorkspaceViewSchema,
  members: z.array(MemberViewSchema),
  tasks: z.array(TaskViewSchema),
  locks: z.array(LockViewSchema),
  allocations: z.array(AllocationViewSchema).default([]),
  files: z.array(FileViewSchema),
  requests: z.array(RequestViewSchema),
  proposals: z.array(ProposalViewSchema),
  recentEvents: z.array(z.unknown()).default([]),
  cursor: z.number().int().nonnegative(),
});
export type StateRes = z.infer<typeof StateRes>;

// ---- 2.22 file history / 2.23 export -------------------------------------------------------------------------

export const FilesHistoryRes = z.object({
  path: PathSchema,
  versions: z.array(
    z.object({
      version: z.number().int().nonnegative(),
      by: MemberIdSchema,
      taskId: TaskIdSchema.nullable(),
      ai: z.boolean(),
      ts: EpochMsSchema,
      patch: z.string(),
    }),
  ),
});
export type FilesHistoryRes = z.infer<typeof FilesHistoryRes>;

export const ExportRes = z.object({
  workspace: z.string(),
  exportedAt: EpochMsSchema,
  events: z.array(RadarEventSchema),
});
export type ExportRes = z.infer<typeof ExportRes>;

// ---- 2.24 bob/activity ---------------------------------------------------------------------------------------

const activityBase = {
  sessionId: z.string().max(256).nullable(),
  mode: z.string().min(1).max(64),
  clientTs: EpochMsSchema.optional(),
};
const activityPaths = z.array(PathSchema).max(100).default([]);

export const BobActivityReq = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('session.start'), ...activityBase }),
  z.object({ kind: z.literal('prompt'), ...activityBase, text: z.string().max(ACTIVITY_TEXT_MAX_CHARS).optional() }),
  z.object({ kind: z.literal('tool.pre'), ...activityBase, tool: z.string().min(1).max(128), paths: activityPaths, decision: DecisionSchema }),
  z.object({
    kind: z.literal('tool.post'),
    ...activityBase,
    tool: z.string().min(1).max(128),
    paths: activityPaths,
    linesChanged: z.number().int().nonnegative().optional(),
  }),
  z.object({ kind: z.literal('turn.end'), ...activityBase }),
]);
export type BobActivityReq = z.infer<typeof BobActivityReq>;
/** What a hook builds before validation (defaults such as `paths: []` not applied yet). */
export type BobActivityInput = z.input<typeof BobActivityReq>;
