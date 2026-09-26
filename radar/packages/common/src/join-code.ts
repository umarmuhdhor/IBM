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

export const AdminJoinCodeReq = z.object({
  member: z.string().min(1).max(64),
  ttlHours: z.number().int().min(1).max(JOIN_CODE_TTL_HOURS_MAX).optional(),
});
export type AdminJoinCodeReq = z.infer<typeof AdminJoinCodeReq>;

export const AdminJoinCodeRes = z.object({
  member: z.string(),
  code: z.string(),
  expiresAt: z.number().int(),
});
export type AdminJoinCodeRes = z.infer<typeof AdminJoinCodeRes>;

export const JoinReq = z.object({ code: z.string().min(1).max(32) });
export type JoinReq = z.infer<typeof JoinReq>;

/** `invite` is an rdr_inv_ code with a token minted by this call (the member's older tokens are revoked). */
export const JoinRes = z.object({
  workspace: z.string(),
  member: z.string(),
  role: z.enum(['coder', 'pm']),
  invite: z.string(),
});
export type JoinRes = z.infer<typeof JoinRes>;
