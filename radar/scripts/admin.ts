// `pnpm -C radar admin <init|code|token|invite|export|reset>` (fase 03 step 8): replaces the v0.2 `radar-server` CLI by
// calling the Worker's /admin/* endpoints. ADMIN_SECRET is read from the environment only, never from argv,
// so it does not end up in shell history. Tokens are printed once; store them in the team password manager.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  ADMIN_FILES_MAX_BATCH_BYTES,
  ADMIN_FILES_MAX_PER_BATCH,
  AdminFilesRes,
  AdminInitRes,
  AdminJoinCodeRes,
  AdminMember,
  AdminTokenRes,
  encodeInvite,
  ErrorRes,
  ExportRes,
  isProbablyBinary,
  MAX_FILE_BYTES,
  OkRes,
  StateRes,
} from '../packages/common/src/index.js';
import { createIgnoreMatcher } from '../packages/common/src/node.js';

/** Structural stand-in for a zod schema (zod is not a root dependency). */
type Schema<T> = { safeParse(v: unknown): { success: true; data: T } | { success: false } };

export interface AdminClient {
  server: string;
  secret: string;
  fetchImpl?: typeof fetch;
}

export class AdminError extends Error {
  override readonly name = 'AdminError';
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function adminCall<T>(c: AdminClient, method: 'GET' | 'POST', path: string, body: unknown, schema: Schema<T>): Promise<T> {
  return call(c, { 'x-admin-secret': c.secret }, method, path, body, schema);
}

/** A read with a member token (the admin secret is not sent to member endpoints). */
export function memberCall<T>(c: AdminClient, token: string, path: string, schema: Schema<T>): Promise<T> {
  return call(c, { authorization: `Bearer ${token}` }, 'GET', path, undefined, schema);
}

async function call<T>(c: AdminClient, auth: Record<string, string>, method: 'GET' | 'POST', path: string, body: unknown, schema: Schema<T>): Promise<T> {
  const headers: Record<string, string> = { ...auth };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await (c.fetchImpl ?? fetch)(c.server.replace(/\/+$/, '') + path, {
    method,
    headers,
    body: body === undefined ? null : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!res.ok) {
    const err = ErrorRes.safeParse(json);
    if (err.success) throw new AdminError(res.status, err.data.error.code, `${method} ${path}: ${res.status} ${err.data.error.code} — ${err.data.error.message}`);
    throw new AdminError(res.status, 'INTERNAL', `${method} ${path}: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AdminError(res.status, 'INTERNAL', `${method} ${path}: unexpected response shape`);
  return parsed.data;
}

/** `A:coder:Alice:alice@example.com` (e-mail optional). */
export function parseMemberSpec(spec: string): AdminMember {
  const [id, role, name, email, ...rest] = spec.split(':');
  if (!id || !role || !name || rest.length > 0) throw new Error(`--member must look like ID:role:Name[:email], got "${spec}"`);
  const m = AdminMember.safeParse({ id, role, name, ...(email ? { email } : {}) });
  if (!m.success) throw new Error(`--member "${spec}": ${m.error.issues[0]?.message ?? 'invalid'}`);
  return m.data;
}

export interface RepoFile {
  path: string;
  content: string;
}

/** Tracked files of a local clone that pass the sync rules (R5 §6): ignore list, size limit, not binary. */
export function collectRepoFiles(repoDir: string): { files: RepoFile[]; skipped: { path: string; reason: string }[] } {
  const listed = execFileSync('git', ['-C', repoDir, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const ignore = createIgnoreMatcher(repoDir);
  const files: RepoFile[] = [];
  const skipped: { path: string; reason: string }[] = [];
  for (const path of listed.sort()) {
    if (ignore.ignores(path)) {
      skipped.push({ path, reason: 'ignored' });
      continue;
    }
    let buf: Buffer;
    try {
      buf = readFileSync(join(repoDir, path));
    } catch {
      skipped.push({ path, reason: 'unreadable' });
      continue;
    }
    if (buf.byteLength > MAX_FILE_BYTES) skipped.push({ path, reason: 'too_large' });
    else if (isProbablyBinary(buf)) skipped.push({ path, reason: 'binary' });
    else files.push({ path, content: buf.toString('utf8') });
  }
  return { files, skipped };
}

/** Splits files into `/admin/files` batches of at most 100 files and 4 MB. */
export function batchFiles(files: readonly RepoFile[], maxFiles = ADMIN_FILES_MAX_PER_BATCH, maxBytes = ADMIN_FILES_MAX_BATCH_BYTES): RepoFile[][] {
  const batches: RepoFile[][] = [];
  let current: RepoFile[] = [];
  let bytes = 0;
  for (const f of files) {
    const size = Buffer.byteLength(f.content, 'utf8');
    if (current.length > 0 && (current.length >= maxFiles || bytes + size > maxBytes)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(f);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function headCommitOf(repoDir: string): string {
  return execFileSync('git', ['-C', repoDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

export interface InitOptions {
  workspace: string;
  repo?: string | undefined;
  branch: string;
  members: AdminMember[];
  force: boolean;
  files: RepoFile[];
  headCommit: string | null;
}

export async function runInit(c: AdminClient, o: InitOptions): Promise<{ tokens: Record<string, string>; inserted: number; headCommit: string | null }> {
  const init = await adminCall(
    c,
    'POST',
    '/admin/init',
    { workspace: o.workspace, ...(o.repo ? { repo: o.repo } : {}), branch: o.branch, members: o.members, ...(o.force ? { force: true } : {}) },
    AdminInitRes,
  );
  let inserted = 0;
  let headCommit: string | null = null;
  const batches = batchFiles(o.files);
  // An empty repo still records the head commit.
  if (batches.length === 0 && o.headCommit) batches.push([]);
  for (const batch of batches) {
    const r = await adminCall(c, 'POST', '/admin/files', { headCommit: o.headCommit, files: batch }, AdminFilesRes);
    inserted += r.inserted;
    headCommit = r.headCommit;
  }
  return { tokens: init.tokens, inserted, headCommit };
}

export function formatTokenTable(tokens: Record<string, string>): string {
  const rows = Object.entries(tokens);
  const w = Math.max(6, ...rows.map(([k]) => k.length));
  return [`${'member'.padEnd(w)}  token`, ...rows.map(([k, v]) => `${k.padEnd(w)}  ${v}`)].join('\n');
}

/** IN-03 (D-alief-09): one short code per member plus the command a teammate pastes in a terminal. */
export async function makeJoinCodes(c: AdminClient, members: string[], ttlHours?: number): Promise<string[]> {
  const server = c.server.replace(/\/+$/, '');
  const lines: string[] = [];
  for (const member of members) {
    const r = await adminCall(c, 'POST', '/admin/join-code', { member, ...(ttlHours ? { ttlHours } : {}) }, AdminJoinCodeRes);
    lines.push(`${r.member}  ${r.code}  curl -fsSL ${server}/j/${r.code} | sh`);
  }
  const until = new Date(Date.now() + (ttlHours ?? 72) * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
  return [`Join codes (valid until ${until} UTC; each use signs that member in on the new device):`, ...lines];
}

const USAGE = `usage (ADMIN_SECRET must be set in the environment):
  admin init   --server <url> --workspace <name> [--repo owner/name] [--branch main] [--repo-dir <clone>]
               --member ID:role:Name[:email] ... [--force]
  admin code   --server <url> --member <ID> ... [--ttl-hours 72]   (short join code + one-line install command)
  admin token  --server <url> --member <ID|mc>
  admin invite --server <url> --member <ID>   (rotates the token; prints an rdr_inv_ code for radar join --invite)
  admin export --server <url> [--out <file>] [--from <id>] [--to <id>]
  admin reset  --server <url> --confirm`;

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env, out: (s: string) => void = console.log): Promise<number> {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      server: { type: 'string' },
      workspace: { type: 'string' },
      repo: { type: 'string' },
      branch: { type: 'string', default: 'main' },
      'repo-dir': { type: 'string' },
      member: { type: 'string', multiple: true },
      force: { type: 'boolean', default: false },
      confirm: { type: 'boolean', default: false },
      out: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      'ttl-hours': { type: 'string' },
    },
  });
  if (!command || !['init', 'code', 'token', 'invite', 'export', 'reset'].includes(command) || !values.server) {
    out(USAGE);
    return 2;
  }
  const secret = env.ADMIN_SECRET;
  if (!secret) {
    out('ADMIN_SECRET is not set. Export it in this shell first (never pass it as an argument).');
    return 2;
  }
  const c: AdminClient = { server: values.server, secret };

  if (command === 'init') {
    if (!values.workspace || !values.member?.length) {
      out(USAGE);
      return 2;
    }
    const members = values.member.map(parseMemberSpec);
    let files: RepoFile[] = [];
    let headCommit: string | null = null;
    if (values['repo-dir']) {
      const dir = resolve(values['repo-dir']);
      const collected = collectRepoFiles(dir);
      files = collected.files;
      headCommit = headCommitOf(dir);
      out(`files: ${files.length} to import, ${collected.skipped.length} skipped, HEAD ${headCommit.slice(0, 7)}`);
    }
    const r = await runInit(c, { workspace: values.workspace, repo: values.repo, branch: values.branch, members, force: values.force, files, headCommit });
    out(`imported ${r.inserted} files, head ${r.headCommit ?? '(none)'}`);
    out('Tokens (shown once; store them in the team password manager, never in the repo or a public chat):');
    out(formatTokenTable(r.tokens));
    out('');
    try {
      for (const l of await makeJoinCodes(c, members.map((m) => m.id))) out(l);
    } catch (e) {
      // Init already succeeded; an older server simply has no join codes.
      out(`Join codes skipped (${e instanceof Error ? e.message : String(e)}). Tokens above still work.`);
    }
    return 0;
  }
  if (command === 'code') {
    const ttl = values['ttl-hours'] === undefined ? undefined : Number(values['ttl-hours']);
    if (!values.member?.length || (ttl !== undefined && !(Number.isInteger(ttl) && ttl >= 1 && ttl <= 720))) {
      out(USAGE);
      return 2;
    }
    for (const l of await makeJoinCodes(c, values.member, ttl)) out(l);
    return 0;
  }
  if (command === 'token') {
    const member = values.member?.[0];
    if (!member) {
      out(USAGE);
      return 2;
    }
    const r = await adminCall(c, 'POST', '/admin/token', { member, rotate: true }, AdminTokenRes);
    out(formatTokenTable({ [r.member]: r.token }));
    return 0;
  }
  if (command === 'invite') {
    const member = values.member?.[0];
    if (!member || member === 'mc') {
      out(member === 'mc' ? 'invite is for coder/pm members; use `admin token --member mc` for Mission Control.' : USAGE);
      return 2;
    }
    const r = await adminCall(c, 'POST', '/admin/token', { member, rotate: true }, AdminTokenRes);
    let workspace: string;
    try {
      workspace = (await memberCall(c, r.token, '/v1/state', StateRes)).workspace.name;
    } catch (e) {
      // The old token is already revoked: never lose the new one because the second call failed.
      out(`Token rotated, but reading the workspace name failed (${e instanceof Error ? e.message : String(e)}).`);
      out('New token (shown once; use radar join <server> --workspace <name> --as <ID> with RADAR_TOKEN):');
      out(formatTokenTable({ [r.member]: r.token }));
      return 1;
    }
    out(`Invite for ${r.member} (shown once; the old token no longer works; share it privately, never in the repo or a public chat):`);
    out(encodeInvite({ server: c.server, workspace, member: r.member, token: r.token }));
    return 0;
  }
  if (command === 'export') {
    const q = new URLSearchParams();
    if (values.from) q.set('from', values.from);
    if (values.to) q.set('to', values.to);
    const r = await adminCall(c, 'GET', `/admin/export${q.size ? `?${q}` : ''}`, undefined, ExportRes);
    const text = JSON.stringify(r, null, 2);
    if (values.out) {
      writeFileSync(values.out, `${text}\n`);
      out(`wrote ${r.events.length} events to ${values.out}`);
    } else {
      out(text);
    }
    return 0;
  }
  if (!values.confirm) {
    out('reset deletes every row of the workspace. Re-run with --confirm.');
    return 2;
  }
  await adminCall(c, 'POST', '/admin/reset', { confirm: true }, OkRes);
  out('workspace reset');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
