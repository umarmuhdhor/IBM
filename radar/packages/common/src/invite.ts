// IN-02 invite code (fase 12, v0.3): one string that holds everything `radar join` and the app's Settings need.
// `rdr_inv_` + base64url(JSON {v, server, workspace, member, token}). It carries a member token, so it is a
// secret: printed once by `admin invite`, shared privately, never committed or pasted in a public chat.
// No node:* imports: the desktop app decodes it in the renderer.
import { z } from 'zod';

export const INVITE_PREFIX = 'rdr_inv_';

export const Invite = z.object({
  v: z.literal(1),
  server: z.string().url(),
  workspace: z.string().min(1),
  member: z.string().min(1),
  token: z.string().min(1),
});
export type Invite = z.infer<typeof Invite>;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeInvite(i: Omit<Invite, 'v'>): string {
  const body: Invite = Invite.parse({ v: 1, ...i, server: i.server.replace(/\/+$/, '') });
  return INVITE_PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
}

export class InviteInvalidError extends Error {
  override readonly name = 'InviteInvalidError';
}

/** Throws InviteInvalidError without echoing the code (it holds a token). */
export function decodeInvite(code: string): Invite {
  const s = code.trim();
  if (!s.startsWith(INVITE_PREFIX)) throw new InviteInvalidError(`Kode undangan harus diawali ${INVITE_PREFIX}.`);
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(fromBase64Url(s.slice(INVITE_PREFIX.length))));
  } catch {
    throw new InviteInvalidError('Kode undangan rusak atau terpotong.');
  }
  const parsed = Invite.safeParse(raw);
  if (!parsed.success) throw new InviteInvalidError('Kode undangan tidak lengkap atau dari versi lain.');
  return parsed.data;
}
