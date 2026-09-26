// Test helpers: a scriptable fake Radar server (node:http) and a runner that spawns the bundled hooks.
// The fake server covers edge cases (timeouts, 5xx, slow stdin); mock_contract.test.ts runs the same bundles
// against the fase 02 mock server for the real R3 shapes.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

export interface Recorded {
  method: string;
  path: string;
  auth: string | undefined;
  body: unknown;
}

export type Handler = (req: Recorded) => { status?: number; json?: unknown; delayMs?: number } | undefined;

export interface FakeServer {
  url: string;
  requests: Recorded[];
  handle: Handler;
  close(): Promise<void>;
}

export async function startFakeServer(handle: Handler = () => undefined): Promise<FakeServer> {
  const fake: FakeServer = { url: '', requests: [], handle, close: async () => undefined };
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      const rec: Recorded = {
        method: req.method ?? 'GET',
        path: req.url ?? '/',
        auth: req.headers.authorization,
        body: raw ? (JSON.parse(raw) as unknown) : undefined,
      };
      fake.requests.push(rec);
      const out = fake.handle(rec) ?? { status: 204 };
      const send = () => {
        if (res.destroyed) return;
        res.statusCode = out.status ?? (out.json === undefined ? 204 : 200);
        if (out.json !== undefined) res.setHeader('content-type', 'application/json');
        res.end(out.json === undefined ? undefined : JSON.stringify(out.json));
      };
      if (out.delayMs) setTimeout(send, out.delayMs);
      else send();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.close = () =>
    new Promise<void>((r) => {
      server.closeAllConnections();
      server.close(() => r());
    });
  return fake;
}

/** A port nobody listens on (bind, read the port, close). */
export async function deadServerUrl(): Promise<string> {
  const s = createServer();
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const port = (s.address() as AddressInfo).port;
  await new Promise<void>((r) => s.close(() => r()));
  return `http://127.0.0.1:${port}`;
}

const pkgRoot = resolve(import.meta.dirname, '..');
export const HOOK_NAMES = ['lock_guard', 'brief', 'mark_ai_edit', 'stop'] as const;
export type HookName = (typeof HOOK_NAMES)[number];

/** Bundle every hook the same way build.mjs does (CJS, node20) into a temp dir. */
export async function bundleHooks(): Promise<Record<HookName, string>> {
  const outdir = mkdtempSync(join(tmpdir(), 'radar-hooks-'));
  // the bundles are CommonJS: make sure a parent "type": "module" does not turn them into ESM
  writeFileSync(join(outdir, 'package.json'), '{ "type": "commonjs" }\n');
  await build({
    // only entries that exist, so each hook's tests can go green on their own
    entryPoints: HOOK_NAMES.map((n) => join(pkgRoot, 'src', `${n}.ts`)).filter((f) => existsSync(f)),
    outdir,
    bundle: true,
    alias: {
      '@radar/common/node': join(pkgRoot, '../common/src/node.ts'),
      '@radar/common': join(pkgRoot, '../common/src/index.ts'),
    },
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    logLevel: 'silent',
  });
  return Object.fromEntries(HOOK_NAMES.map((n) => [n, join(outdir, `${n}.js`)])) as Record<HookName, string>;
}

export function makeWorkspace(local?: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'radar-ws-'));
  mkdirSync(join(root, '.radar'), { recursive: true });
  if (local) writeFileSync(join(root, '.radar', 'local.json'), JSON.stringify(local));
  return root;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  ms: number;
}

export function runHook(
  file: string,
  args: string[],
  stdin: unknown,
  env: Record<string, string>,
  cwd: string,
  opts: { keepStdinOpen?: boolean } = {},
): Promise<RunResult> {
  return new Promise((resolveRun) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [file, ...args], {
      cwd,
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    child.on('close', (code) => resolveRun({ code, stdout, stderr, ms: Date.now() - t0 }));
    const data = typeof stdin === 'string' ? stdin : JSON.stringify(stdin);
    // keepStdinOpen: write the payload but never close stdin (a host that forgets EOF)
    if (opts.keepStdinOpen) child.stdin.write(data);
    else child.stdin.end(data);
    child.on('close', () => child.stdin.destroy());
  });
}

/** A PreToolUse payload in the real Bob IDE 2.2.0 shape (radar/docs/spike-payloads/pre-tool-use.apply_diff.json). */
export function prePayload(root: string, path: string, tool = 'apply_diff') {
  return {
    session_id: '0123456789abcdef0123456789abcdef',
    cwd: root,
    hook_event_name: 'PreToolUse',
    tool_name: tool,
    tool_input: { path, diff: '<<<<<<< SEARCH\n-------\na\n=======\nb\n>>>>>>> REPLACE' },
    tool_use_id: 'tooluse_EXAMPLE000000000000000',
  };
}
