// Shared helpers for the sync tests: a real Worker + Durable Object from ../server (wrangler createTestHarness),
// seeded through the admin API, and temp workspace folders (R5 §3).
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestHarness } from 'wrangler';

export const ADMIN_SECRET = 'test';
const SERVER_CONFIG = fileURLToPath(new URL('../../server/wrangler.jsonc', import.meta.url));

export interface TestServer {
  url: string;
  close(): Promise<void>;
}

export async function startServer(): Promise<TestServer> {
  const harness = createTestHarness({
    workers: [{ configPath: SERVER_CONFIG, vars: { GITHUB_COMMIT: 'false' }, secrets: { ADMIN_SECRET } }],
  });
  const { url } = await harness.listen();
  return { url: url.origin, close: () => harness.close() };
}

export const MEMBERS = [
  { id: 'A', role: 'coder', name: 'Andi' },
  { id: 'B', role: 'coder', name: 'Budi' },
  { id: 'C', role: 'pm', name: 'Citra' },
] as const;

/** `/admin/init` (force, so every test starts from an empty workspace) + one `/admin/files` batch. */
export async function seedTestWorkspace(url: string, files: { path: string; content: string }[]): Promise<Record<string, string>> {
  const headers = { 'content-type': 'application/json', 'x-admin-secret': ADMIN_SECRET };
  const init = await fetch(`${url}/admin/init`, { method: 'POST', headers, body: JSON.stringify({ workspace: 'toko-demo', members: MEMBERS, force: true }) });
  if (init.status !== 201) throw new Error(`init failed: ${init.status} ${await init.text()}`);
  const { tokens } = (await init.json()) as { tokens: Record<string, string> };
  if (files.length > 0) {
    const r = await fetch(`${url}/admin/files`, { method: 'POST', headers, body: JSON.stringify({ headCommit: null, files }) });
    if (r.status !== 200) throw new Error(`files failed: ${r.status} ${await r.text()}`);
  }
  return tokens;
}

const dirs: string[] = [];
export function tempDir(prefix = 'radar-sync-'): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}
export function cleanupDirs(): void {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls `fn` every 20 ms until it returns true; returns the elapsed ms or throws after `timeoutMs`. */
export async function waitFor(fn: () => boolean, timeoutMs = 3000, what = 'condition'): Promise<number> {
  const t0 = Date.now();
  for (;;) {
    if (fn()) return Date.now() - t0;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout after ${timeoutMs} ms waiting for ${what}`);
    await sleep(20);
  }
}

export function read(root: string, rel: string): string | null {
  const p = join(root, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Fast timers for tests; the defaults are the R5 §4 constants. */
export const FAST = { heartbeatMs: 60_000, pingMs: 60_000, reconnect: { minMs: 50, maxMs: 200 } } as const;
