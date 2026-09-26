// IN-03 short join code (D-alief-09): `K7QM-3XPA`, typed or pasted by a teammate instead of the long rdr_inv_ code.
// The server stores only its sha256; redeeming it (`POST /v1/join`) mints a fresh member token and returns an
// rdr_inv_ invite, so the rest of the join flow is unchanged. Crockford base32 (no I, L, O, U): easy to read aloud.
import { z } from 'zod';

export const JOIN_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const JOIN_CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
export const JOIN_CODE_TTL_HOURS_DEFAULT = 72;
export const JOIN_CODE_TTL_HOURS_MAX = 720;

/** Upper-cases, drops spaces and dashes, maps the Crockford look-alikes (O→0, I/L→1), re-inserts the dash. */
export function normalizeJoinCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== 8) return null;
  const code = `${s.slice(0, 4)}-${s.slice(4)}`;
  return JOIN_CODE_RE.test(code) ? code : null;
}

/** 8 random symbols, 40 bits. 32 divides 256, so `byte & 31` is unbiased. */
export function newJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = Array.from(bytes, (b) => JOIN_CODE_ALPHABET[b & 31]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Member ids a code-joined teammate gets, in order: the first free one wins. */
export const JOIN_MEMBER_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

/**
 * Without `member` the code is open: the first person to redeem it becomes a new member with their own name and role.
 * `owner: true` makes an owner code instead (D-alief-11): redeeming it connects the owner's app as Mission Control.
 */
export const AdminJoinCodeReq = z
  .object({
    member: z.string().min(1).max(64).optional(),
    owner: z.boolean().optional(),
    ttlHours: z.number().int().min(1).max(JOIN_CODE_TTL_HOURS_MAX).optional(),
  })
  .refine((r) => !(r.owner && r.member), { message: 'An owner code cannot belong to a member.' });
export type AdminJoinCodeReq = z.infer<typeof AdminJoinCodeReq>;

export const AdminJoinCodeRes = z.object({
  /** null for an open code and for an owner code. */
  member: z.string().nullable(),
  /** true for an owner code (Mission Control). Absent from servers before D-alief-11. */
  owner: z.boolean().optional(),
  code: z.string(),
  expiresAt: z.number().int(),
});
export type AdminJoinCodeRes = z.infer<typeof AdminJoinCodeRes>;

/** `name` and `role` are required for an open code and ignored for a code that already belongs to a member. */
export const JoinReq = z.object({
  code: z.string().min(1).max(32),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['coder', 'pm']).optional(),
});
export type JoinReq = z.infer<typeof JoinReq>;

/** `invite` is an rdr_inv_ code with a token minted by this call (the member's older tokens are revoked). */
export const JoinMemberRes = z.object({
  workspace: z.string(),
  member: z.string(),
  role: z.enum(['coder', 'pm']),
  invite: z.string(),
});
export type JoinMemberRes = z.infer<typeof JoinMemberRes>;

/** An owner code (D-alief-11): a new Mission Control token; older mc tokens are revoked. */
export const JoinOwnerRes = z.object({
  workspace: z.string(),
  member: z.null(),
  role: z.literal('mc'),
  token: z.string(),
});
export type JoinOwnerRes = z.infer<typeof JoinOwnerRes>;

export const JoinRes = z.union([JoinMemberRes, JoinOwnerRes]);
export type JoinRes = z.infer<typeof JoinRes>;

/**
 * D-alief-12: the owner's app opens a folder as this server's workspace (one workspace per server). Allowed without a
 * token while the server is empty; afterwards only with the current Mission Control token, and it replaces everything.
 * The owner becomes member A and syncs the folder like a teammate.
 */
export const OpenWorkspaceReq = z.object({
  workspace: z.string().trim().min(1).max(64),
  owner: z.object({ name: z.string().trim().min(1).max(100), role: z.enum(['coder', 'pm']) }),
});
export type OpenWorkspaceReq = z.infer<typeof OpenWorkspaceReq>;

/** `invite` is the owner's own member invite (for their sync agent); `code` is a first open join code to share. */
export const OpenWorkspaceRes = z.object({
  workspace: z.string(),
  member: z.string(),
  invite: z.string(),
  mcToken: z.string(),
  code: z.string(),
  expiresAt: z.number().int(),
});
export type OpenWorkspaceRes = z.infer<typeof OpenWorkspaceRes>;
