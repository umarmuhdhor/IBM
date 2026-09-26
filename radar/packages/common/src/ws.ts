// WebSocket envelope `{ t, id?, d }` (R3 §3). Ping/pong are the exact strings in constants.ts, not JSON objects.
import { z } from 'zod';
import {
  EpochMsSchema,
  LockHolder,
  LockStateSchema,
  LockStateViewSchema,
  MemberIdSchema,
  PathSchema,
  PrincipalSchema,
  ProposalItem,
  RadarEventSchema,
  StateRes,
  TaskIdSchema,
} from './schemas.js';
import { TermMessageSchema } from './term.js';

const msg = <T extends string, D extends z.ZodType>(t: T, d: D) =>
  z.object({ t: z.literal(t), id: z.string().optional(), d });

const Version = z.number().int().nonnegative();

export const WsClientKindSchema = z.enum(['sync', 'mc', 'app']);
export type WsClientKind = z.infer<typeof WsClientKindSchema>;

export const FileRejectReasonSchema = z.enum(['held_by_other', 'committing', 'pm_readonly', 'conflict', 'too_large', 'binary']);

const ServerFile = z.object({ version: Version, hash: z.string().nullable(), content: z.string().nullable(), deleted: z.boolean() });

export const LockChangedData = z.object({
  path: PathSchema,
  state: LockStateViewSchema,
  taskId: TaskIdSchema.nullable(),
  memberId: MemberIdSchema.nullable(),
  queue: z.array(TaskIdSchema),
});

export const CoreWsMessageSchema = z.discriminatedUnion('t', [
  msg(
    'hello',
    z.object({
      token: z.string().min(1),
      client: WsClientKindSchema,
      clientVersion: z.string(),
      knownVersions: z.record(z.string(), Version).optional(),
    }),
  ),
  msg('welcome', z.object({ principal: PrincipalSchema, serverTime: EpochMsSchema, workspace: z.string() })),
  msg(
    'snapshot',
    z.object({
      files: z.array(z.object({ path: PathSchema, version: Version, hash: z.string().nullable(), content: z.string().nullable(), deleted: z.boolean() })),
      locks: z.array(z.object({ path: PathSchema, taskId: TaskIdSchema, memberId: MemberIdSchema, state: LockStateSchema, queue: z.array(TaskIdSchema) })),
      cursor: z.number().int().nonnegative(),
    }),
  ),
  msg('state', StateRes),
  msg('file.update', z.object({ path: PathSchema, baseVersion: Version, content: z.string(), hash: z.string(), clientTs: EpochMsSchema })),
  msg('file.delete', z.object({ path: PathSchema, baseVersion: Version, clientTs: EpochMsSchema })),
  msg('file.ack', z.object({ id: z.string().optional(), path: PathSchema, version: Version, hash: z.string() })),
  msg(
    'file.changed',
    z.object({
      path: PathSchema,
      version: Version,
      content: z.string().nullable(),
      hash: z.string().nullable(),
      deleted: z.boolean(),
      by: MemberIdSchema,
      taskId: TaskIdSchema.nullable(),
      serverTs: EpochMsSchema,
    }),
  ),
  msg('file.applied', z.object({ path: PathSchema, version: Version, serverTs: EpochMsSchema, appliedTs: EpochMsSchema })),
  msg(
    'file.rejected',
    z.object({
      id: z.string().optional(),
      path: PathSchema,
      reason: FileRejectReasonSchema,
      holder: LockHolder.nullable().optional(),
      server: ServerFile,
    }),
  ),
  msg('lock.changed', LockChangedData),
  msg('event', RadarEventSchema),
  msg('notice', z.object({ level: z.enum(['info', 'warn']), message: z.string() })),
  msg('proposal.new', z.object({ proposal: ProposalItem })),
  msg('proposal.decided', z.object({ proposal: ProposalItem })),
  msg('heartbeat', z.object({ ts: EpochMsSchema })),
  msg('error', z.object({ code: z.string(), message: z.string() })),
]);

export const WsMessageSchema = z.union([CoreWsMessageSchema, TermMessageSchema]);
export type WsMessage = z.infer<typeof WsMessageSchema>;
export type WsMessageType = WsMessage['t'];
export type WsMessageOf<T extends WsMessageType> = Extract<WsMessage, { t: T }>;

/** WebSocket close code when `hello` is missing or invalid (R3 §3). */
export const WS_CLOSE_UNAUTHORIZED = 4401;
