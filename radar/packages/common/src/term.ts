// Terminal relay messages `term.*` (R3 §3.9, P1). Watch Bob P0 uses bob.activity instead.
import { z } from 'zod';
import { TERM_FRAME_MAX_BYTES } from './constants.js';
import { MemberIdSchema } from './schemas.js';

const TermId = z.string().min(1).max(64);
/** base64 of at most TERM_FRAME_MAX_BYTES raw bytes. */
const FrameData = z.string().max(Math.ceil(TERM_FRAME_MAX_BYTES / 3) * 4);

const msg = <T extends string, D extends z.ZodType>(t: T, d: D) =>
  z.object({ t: z.literal(t), id: z.string().optional(), d });

export const TermMessageSchema = z.discriminatedUnion('t', [
  msg('term.share', z.object({ termId: TermId, title: z.string().max(200), agent: z.string().min(1), cols: z.number().int().positive(), rows: z.number().int().positive() })),
  msg('term.unshare', z.object({ termId: TermId })),
  msg(
    'term.list',
    z.object({
      terms: z.array(
        z.object({
          termId: TermId,
          member: MemberIdSchema,
          title: z.string(),
          agent: z.string(),
          viewers: z.array(MemberIdSchema),
          guest: MemberIdSchema.optional(),
        }),
      ),
    }),
  ),
  msg('term.subscribe', z.object({ termId: TermId })),
  msg('term.unsubscribe', z.object({ termId: TermId })),
  msg('term.need_snapshot', z.object({ termId: TermId })),
  msg('term.snapshot', z.object({ termId: TermId, seq: z.number().int().nonnegative(), data: z.string().max(262_144) })),
  msg('term.frame', z.object({ termId: TermId, seq: z.number().int().nonnegative(), data: FrameData, ts: z.number() })),
  msg('term.resize', z.object({ termId: TermId, cols: z.number().int().positive(), rows: z.number().int().positive() })),
  msg('term.ended', z.object({ termId: TermId, reason: z.enum(['unshared', 'host_offline']) })),
  msg('term.ack', z.object({ termId: TermId, seq: z.number().int().nonnegative(), viewerTs: z.number() })),
  msg('term.input.request', z.object({ termId: TermId, guest: MemberIdSchema })),
  msg('term.input.grant', z.object({ termId: TermId, guest: MemberIdSchema, until: z.number() })),
  msg('term.input.revoke', z.object({ termId: TermId, guest: MemberIdSchema, until: z.number() })),
  msg('term.input', z.object({ termId: TermId, guest: MemberIdSchema, data: z.string().max(4096) })),
]);
export type TermMessage = z.infer<typeof TermMessageSchema>;
