// `file.update` acceptance (R4 §3 "Penerimaan file.update", SY-04 second layer). Synchronous on purpose: the
// caller runs it inside one `db.tx`, so reading the current version and writing the next one cannot interleave.
import {
  isProbablyBinary,
  MAX_FILE_BYTES,
  normalizeRelative,
  PathOutsideWorkspaceError,
  type BlockVia,
  type FileRejectReasonSchema,
  type LockHolder,
} from '@radar/common';
import type { z } from 'zod';
import { sha256Hex } from '../crypto';
import { getFile, writeFileVersion, type FileRow } from '../db/repo/file';
import type { Db } from '../db/sql';
import type { MemberPrincipal } from '../http/auth';
import { appendEvent } from './events';
import type { UnitOfWork } from './uow';

type RejectReason = z.infer<typeof FileRejectReasonSchema>;

export type WriteDecision =
  | { allow: true; taskId: string | null }
  | { allow: false; reason: 'held_by_other' | 'committing' | 'pm_readonly'; holder: LockHolder | null };

/** Injection point for the lock engine. Fase 05 replaces it with `locks.checkWrite` (R4 §3). */
export type AuthorizeWrite = (db: Db, member: MemberPrincipal, path: string, via: BlockVia) => WriteDecision;

/** Fase 03 rule: pm is read-only, every coder may write. */
export const authorizeWriteBasic: AuthorizeWrite = (_db, member) =>
  member.role === 'pm' ? { allow: false, reason: 'pm_readonly', holder: null } : { allow: true, taskId: null };

export interface ServerFile {
  version: number;
  hash: string | null;
  content: string | null;
  deleted: boolean;
}

export type UpdateResult =
  | { ok: true; path: string; version: number; hash: string; content: string; changed: boolean; taskId: string | null }
  | { ok: false; path: string; reason: RejectReason; holder: LockHolder | null; server: ServerFile };

export interface UpdateInput {
  path: string;
  baseVersion: number;
  content: string;
  hash: string;
}

const NO_FILE: ServerFile = { version: 0, hash: null, content: null, deleted: false };
const encoder = new TextEncoder();

export function serverCopy(f: FileRow | null): ServerFile {
  if (!f) return NO_FILE;
  return f.deleted ? { version: f.version, hash: null, content: null, deleted: true } : { version: f.version, hash: f.hash, content: f.content, deleted: false };
}

/** Workspace-relative path, or null when it is empty or outside the workspace. */
export function cleanPath(raw: string): string | null {
  try {
    const rel = normalizeRelative(raw);
    return rel === '' ? null : rel;
  } catch (err) {
    if (err instanceof PathOutsideWorkspaceError) return null;
    throw err;
  }
}

export function applyUpdate(
  db: Db,
  uow: UnitOfWork,
  deps: { now: number; authorizeWrite: AuthorizeWrite },
  member: MemberPrincipal,
  input: UpdateInput,
): UpdateResult {
  const bytes = encoder.encode(input.content);
  const reject = (path: string, reason: RejectReason, server: ServerFile = NO_FILE, holder: LockHolder | null = null): UpdateResult => ({
    ok: false,
    path,
    reason,
    holder,
    server,
  });

  if (bytes.byteLength > MAX_FILE_BYTES) return reject(input.path, 'too_large');
  if (isProbablyBinary(bytes)) return reject(input.path, 'binary');
  const hash = sha256Hex(bytes);
  // A hash mismatch means the client read a half-written file; it re-sends after the next save.
  if (hash !== input.hash) return reject(input.path, 'conflict');
  const path = cleanPath(input.path);
  // R3 has no invalid-path reason; `conflict` makes the sync agent keep its copy and re-fetch.
  if (path === null) return reject(input.path, 'conflict');

  const f = getFile(db, path);
  const decision = deps.authorizeWrite(db, member, path, 'sync');
  if (!decision.allow) {
    appendEvent(db, uow, {
      ts: deps.now,
      actor: member.memberId,
      type: 'file.rejected',
      payload: { path, by: member.memberId, reason: decision.reason, holderMemberId: decision.holder?.memberId ?? null, holderTaskId: decision.holder?.taskId ?? null },
    });
    return reject(path, decision.reason, serverCopy(f), decision.holder);
  }
  // SY-07: a PC that fell behind another member's write loses; the server copy wins.
  if (f && input.baseVersion < f.version && f.updated_by !== member.memberId) return reject(path, 'conflict', serverCopy(f));
  if (f && !f.deleted && f.hash === hash) {
    return { ok: true, path, version: f.version, hash, content: input.content, changed: false, taskId: decision.taskId };
  }

  const version = (f?.version ?? 0) + 1;
  const taskId = decision.taskId;
  writeFileVersion(db, { path, version, hash, content: input.content, size: bytes.byteLength, by: member.memberId, taskId, now: deps.now });
  if (taskId !== null) {
    db.run(
      `INSERT INTO task_touch (task_id, path, first_version, last_version) VALUES (?, ?, ?, ?)
       ON CONFLICT(task_id, path) DO UPDATE SET last_version = excluded.last_version, deleted = 0`,
      taskId,
      path,
      f?.version ?? 0,
      version,
    );
    db.run('UPDATE task SET edit_count = edit_count + 1, updated_at = ? WHERE id = ?', deps.now, taskId);
  }
  appendEvent(db, uow, {
    ts: deps.now,
    actor: member.memberId,
    type: 'file.changed',
    payload: { path, version, hash, by: member.memberId, taskId, size: bytes.byteLength },
  });
  return { ok: true, path, version, hash, content: input.content, changed: true, taskId };
}
