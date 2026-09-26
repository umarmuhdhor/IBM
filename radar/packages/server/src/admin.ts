// `/admin/*` (fase 03 step 8): workspace bootstrap and maintenance, called by `scripts/admin.ts`.
// Every route needs `x-admin-secret`. Plain tokens appear only in the init/rotate responses, never in storage or logs.
import {
  ADMIN_FILES_MAX_BATCH_BYTES,
  AdminFilesReq,
  AdminInitReq,
  AdminResetReq,
  AdminTokenReq,
  createIgnoreMatcherFromText,
  isProbablyBinary,
  MAX_FILE_BYTES,
  MEMBER_COLORS,
  type AdminFilesRes,
  type AdminInitRes,
  type AdminTokenRes,
} from '@radar/common';
import type { Hono } from 'hono';
import { newToken, sha256Hex } from './crypto';
import type { WorkspaceDeps } from './deps';
import { insertToken, revokeTokens } from './db/repo/access';
import { initCounters } from './db/repo/counter';
import { getFile, writeFileVersion } from './db/repo/file';
import { getMember, insertMember } from './db/repo/member';
import { getMeta, setMeta } from './db/repo/meta';
import { verifyHeadCommit } from './github';
import { requireAdmin } from './http/auth';
import { parseWith, RadarError, readJson } from './http/errors';
import { ExportQuery } from './http/query';
import { appendEvent } from './services/events';
import { exportEvents } from './services/export';
import { cleanPath } from './services/files';

const PALETTE = Object.values(MEMBER_COLORS);
const encoder = new TextEncoder();

function requireInitialised(deps: WorkspaceDeps): void {
  if (getMeta(deps.db, 'workspace_id') === null) throw new RadarError(409, 'CONFLICT', 'Workspace belum di-init. Jalankan admin init dulu.');
}

export function registerAdminRoutes(app: Hono, deps: WorkspaceDeps): void {
  app.use('/admin/*', async (c, next) => {
    requireAdmin(deps.env.ADMIN_SECRET, c.req.header('x-admin-secret'));
    await next();
  });

  app.post('/admin/init', async (c) => {
    const req = parseWith(AdminInitReq, await readJson(c.req.raw));
    if (getMeta(deps.db, 'workspace_id') !== null) {
      if (!req.force) throw new RadarError(409, 'CONFLICT', 'Workspace sudah ada. Kirim force:true untuk menghapus dan membuat ulang.');
      await deps.wipe();
    }
    const now = deps.now();
    const tokens: Record<string, string> = {};
    deps.transact((uow) => {
      const db = deps.db;
      setMeta(db, 'workspace_id', req.workspace);
      setMeta(db, 'workspace_name', req.workspace);
      setMeta(db, 'created_at', String(now));
      setMeta(db, 'branch', req.branch);
      if (req.repo) setMeta(db, 'repo_url', `https://github.com/${req.repo}`);
      initCounters(db);
      appendEvent(db, uow, { ts: now, actor: 'server', type: 'workspace.created', payload: { workspaceId: req.workspace, headCommit: null, fileCount: 0 } });
      req.members.forEach((m, i) => {
        const color = (MEMBER_COLORS as Record<string, string>)[m.id] ?? PALETTE[i % PALETTE.length] ?? '#78A9FF';
        insertMember(db, { id: m.id, name: m.name, role: m.role, color, gitName: m.name, gitEmail: m.email ?? `${m.id.toLowerCase()}@users.noreply.radar` });
        const token = newToken();
        insertToken(db, { hash: sha256Hex(token), kind: 'member', memberId: m.id, now });
        tokens[m.id] = token;
        appendEvent(db, uow, { ts: now, actor: 'server', type: 'member.created', payload: { memberId: m.id, name: m.name, role: m.role } });
      });
      const mc = newToken();
      insertToken(db, { hash: sha256Hex(mc), kind: 'mc', memberId: null, now });
      tokens.mc = mc;
    });
    const res: AdminInitRes = { workspace: req.workspace, tokens };
    return c.json(res, 201);
  });

  app.post('/admin/files', async (c) => {
    const body = await readJson(c.req.raw);
    requireInitialised(deps);
    const req = parseWith(AdminFilesReq, body);
    const prepared: { path: string; content: string; hash: string; size: number }[] = [];
    let total = 0;
    const ignore = createIgnoreMatcherFromText('');
    for (const f of req.files) {
      const bytes = encoder.encode(f.content);
      total += bytes.byteLength;
      const path = cleanPath(f.path);
      // Same filters as the sync agent (R5 §6): skipped files are simply not imported.
      if (path === null || ignore.ignores(path) || bytes.byteLength > MAX_FILE_BYTES || isProbablyBinary(bytes)) continue;
      prepared.push({ path, content: f.content, hash: sha256Hex(bytes), size: bytes.byteLength });
    }
    if (total > ADMIN_FILES_MAX_BATCH_BYTES) throw new RadarError(422, 'VALIDATION', 'Satu batch maksimal 4 MB.');

    const repoUrl = getMeta(deps.db, 'repo_url');
    // created_at identifies this init: a concurrent `init --force` during the await below changes it.
    const initStamp = getMeta(deps.db, 'created_at');
    if (req.headCommit !== null && deps.env.GITHUB_COMMIT === 'true' && repoUrl) {
      await verifyHeadCommit({
        repo: repoUrl.replace(/^https:\/\/github\.com\//, ''),
        branch: getMeta(deps.db, 'branch') ?? 'main',
        headCommit: req.headCommit,
        token: deps.env.GITHUB_TOKEN,
      });
      // fetch() opens no input gate, so other requests may have run meanwhile (R2 §1).
      if (getMeta(deps.db, 'created_at') !== initStamp) throw new RadarError(409, 'CONFLICT', 'Workspace di-init ulang saat memeriksa headCommit. Kirim ulang batch.');
    }

    const now = deps.now();
    let inserted = 0;
    deps.transact(() => {
      for (const f of prepared) {
        const existing = getFile(deps.db, f.path);
        // Re-importing may refresh a file nobody has edited yet (still v1); later versions belong to the team.
        if (existing && existing.version > 1) continue;
        writeFileVersion(deps.db, { path: f.path, version: 1, hash: f.hash, content: f.content, size: f.size, by: null, taskId: null, now });
        inserted++;
      }
      if (req.headCommit !== null) setMeta(deps.db, 'head_commit', req.headCommit);
    });
    const res: AdminFilesRes = { inserted, headCommit: getMeta(deps.db, 'head_commit') };
    return c.json(res);
  });

  app.post('/admin/token', async (c) => {
    const req = parseWith(AdminTokenReq, await readJson(c.req.raw));
    requireInitialised(deps);
    const isMc = req.member === 'mc';
    if (!isMc && !getMember(deps.db, req.member)) throw new RadarError(404, 'NOT_FOUND', `Member ${req.member} tidak ada.`);
    const token = newToken();
    const now = deps.now();
    deps.transact(() => {
      revokeTokens(deps.db, isMc ? null : req.member, now);
      insertToken(deps.db, { hash: sha256Hex(token), kind: isMc ? 'mc' : 'member', memberId: isMc ? null : req.member, now });
    });
    // Sessions opened with the old token end now.
    for (const { ws, att } of deps.hub.ready()) {
      const p = att.principal;
      if (isMc ? p.kind === 'mc' : p.kind === 'member' && p.memberId === req.member) deps.hub.close(ws, 4401, 'token rotated');
    }
    const res: AdminTokenRes = { member: req.member, token };
    return c.json(res);
  });

  app.get('/admin/export', (c) => {
    const q = parseWith(ExportQuery, c.req.query());
    return c.json(exportEvents(deps.db, deps.workspaceId(), q, deps.now()));
  });

  app.post('/admin/reset', async (c) => {
    parseWith(AdminResetReq, await readJson(c.req.raw));
    await deps.wipe();
    return c.json({ ok: true as const });
  });
}
