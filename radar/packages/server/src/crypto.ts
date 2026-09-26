// Synchronous hashing via node:crypto (nodejs_compat). Keeping file.update and auth free of `await` means a
// WebSocket message is handled start to finish before the DO takes the next one (no interleaving, R2 §1).
import { createHash, timingSafeEqual } from 'node:crypto';

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** `rdr_` + 32 random bytes as base64url (43 chars). Only its sha256 is stored (R2 `token.hash`). */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes));
  return `rdr_${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

/** Constant-time string comparison: both sides are hashed first, so lengths never leak. */
export function safeEqual(a: string, b: string): boolean {
  const da = createHash('sha256').update(a).digest();
  const db = createHash('sha256').update(b).digest();
  return timingSafeEqual(da, db);
}
