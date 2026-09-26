// Bearer token → principal (R3 §1) and the admin secret check (fase 03 step 6). Tokens are hashed before lookup
// and never logged.
import type { Principal } from '@radar/common';
import { safeEqual, sha256Hex } from '../crypto';
import type { Db } from '../db/sql';
import { principalByHash, tokenIsRevoked } from '../db/repo/access';
import { RadarError } from './errors';

export type RoleKey = 'coder' | 'pm' | 'mc';
export type MemberPrincipal = Extract<Principal, { kind: 'member' }>;

export function roleKey(p: Principal): RoleKey {
  return p.kind === 'mc' ? 'mc' : p.role;
}

export function principalForToken(db: Db, token: string): Principal | null {
  if (token.length === 0 || token.length > 256) return null;
  return principalByHash(db, sha256Hex(token));
}

/** Principal from `Authorization: Bearer …`, or null when the header is missing, malformed or unknown. */
export function principalFromHeader(db: Db, header: string | null | undefined): Principal | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return m?.[1] ? principalForToken(db, m[1]) : null;
}

/**
 * The 401 for a token that gives no principal. A revoked token means a newer sign-in on another device; any other
 * token belongs to a workspace that was stopped or replaced, since tokens are random (D-alief-15).
 */
export function unauthorized(db: Db, token: string | null): RadarError {
  if (token && token.length <= 256 && tokenIsRevoked(db, sha256Hex(token)))
    return new RadarError(401, 'UNAUTHORIZED', 'You signed in on another device, so this one was signed out.', 'signed-out');
  return new RadarError(401, 'UNAUTHORIZED', 'This workspace is no longer shared. Join with a new code.', 'workspace-closed');
}

/** 401 without a valid token, 403 when its role is not in `roles` (R3 §1 matrix). */
export function requireRole(db: Db, header: string | null | undefined, roles: readonly RoleKey[]): Principal {
  const p = principalFromHeader(db, header);
  if (!p) throw unauthorized(db, /^Bearer\s+(\S+)\s*$/i.exec(header ?? '')?.[1] ?? null);
  if (!roles.includes(roleKey(p))) throw new RadarError(403, 'FORBIDDEN', 'Your role cannot do this.');
  return p;
}

export function requireMember(db: Db, header: string | null | undefined, roles: readonly ('coder' | 'pm')[]): MemberPrincipal {
  const p = requireRole(db, header, roles);
  if (p.kind !== 'member') throw new RadarError(403, 'FORBIDDEN', 'Only team members can do this.');
  return p;
}

/** `x-admin-secret` must equal ADMIN_SECRET. Fails closed when the secret is not configured. */
export function requireAdmin(configured: string | undefined, given: string | null | undefined): void {
  if (!configured || !given || !safeEqual(configured, given)) {
    throw new RadarError(401, 'UNAUTHORIZED', 'The admin secret is wrong or not configured.');
  }
}
