import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bundleHooks,
  deadServerUrl,
  makeWorkspace,
  prePayload,
  runHook,
  startFakeServer,
  type FakeServer,
  type HookName,
} from './helpers.js';

const BLOCK_MESSAGE =
  'RADAR: src/checkout/checkout.ts sedang dipegang Bob milik Alice (T-1 Kupon). Edit dibatalkan. Jangan coba ulang dan jangan ubah lewat shell. Panggil radar why_blocked, beri tahu user, lalu kerjakan bagian lain dari task T-2.';

function lockCheckResponse(body: { paths: string[] }) {
  const blocked: string[] = body.paths.filter((p) => p === 'src/checkout/checkout.ts');
  return {
    decision: blocked.length ? 'block' : 'allow',
    results: body.paths.map((p) =>
      blocked.includes(p)
        ? {
            path: p,
            decision: 'block',
            reason: 'held_by_other',
            holder: { memberId: 'A', memberName: 'Alice', taskId: 'T-1', taskTitle: 'Kupon', state: 'dipegang' },
          }
        : { path: p, decision: 'allow', reason: 'own' },
    ),
    activeTaskId: 'T-2',
    message: blocked.length ? BLOCK_MESSAGE : '',
    serverMs: 3,
  };
}

let bundles: Record<HookName, string>;
let server: FakeServer;
let root: string;
let env: Record<string, string>;

beforeAll(async () => {
  bundles = await bundleHooks();
  server = await startFakeServer((req) =>
    req.path === '/v1/locks/check' ? { json: lockCheckResponse(req.body as { paths: string[] }) } : undefined,
  );
  root = makeWorkspace();
  env = { RADAR_SERVER: server.url, RADAR_TOKEN: 'tok-b', RADAR_ROOT: root, RADAR_MEMBER: 'B', RADAR_ROLE: 'coder' };
}, 30_000);

afterAll(async () => {
  await server?.close();
});

const run = (payload: unknown, extraEnv: Record<string, string> = {}) =>
  runHook(bundles.lock_guard, [], payload, { ...env, ...extraEnv }, root);

const lockChecks = () => server.requests.filter((r) => r.path === '/v1/locks/check');

describe('lock_guard (PreToolUse, BC-04)', () => {
  it('allows an edit to a file I own: exit 0, nothing on stdout/stderr', async () => {
    server.requests.length = 0;
    const r = await run(prePayload(root, 'src/ui/theme.css'));
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe('');
    const [check] = lockChecks();
    expect(check?.auth).toBe('Bearer tok-b');
    expect(check?.body).toMatchObject({
      paths: ['src/ui/theme.css'],
      tool: 'apply_diff',
      sessionId: '0123456789abcdef0123456789abcdef',
    });
    expect(typeof (check?.body as { clientTs: unknown }).clientTs).toBe('number');
  });

  it("blocks a file held by someone else: exit 2, the server message on stderr, lastBlock saved", async () => {
    server.requests.length = 0;
    const r = await run(prePayload(root, 'src/checkout/checkout.ts'));
    expect(r.code).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('Alice');
    expect(r.stderr).toContain(BLOCK_MESSAGE);
    const state = JSON.parse(readFileSync(join(root, '.radar', 'state.json'), 'utf8')) as {
      lastBlock?: { path: string; message: string };
    };
    expect(state.lastBlock).toMatchObject({ path: 'src/checkout/checkout.ts', message: BLOCK_MESSAGE });
  });

  it('still blocks (exit 2) when .radar/state.json cannot be written', async () => {
    const ws = makeWorkspace();
    mkdirSync(join(ws, '.radar', 'state.json')); // a directory where the file should be
    const r = await runHook(bundles.lock_guard, [], prePayload(ws, 'src/checkout/checkout.ts'), { ...env, RADAR_ROOT: ws }, ws);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('Alice');
  });

  it('reports tool.pre with the decision to /v1/bob/activity (JT-01)', async () => {
    server.requests.length = 0;
    await run(prePayload(root, 'src/checkout/checkout.ts'));
    const activity = server.requests.find((q) => q.path === '/v1/bob/activity');
    expect(activity?.body).toMatchObject({
      kind: 'tool.pre',
      tool: 'apply_diff',
      paths: ['src/checkout/checkout.ts'],
      decision: 'block',
      mode: 'coder',
    });
  });

  it('turns an absolute path inside the workspace into a workspace-relative one', async () => {
    server.requests.length = 0;
    const r = await run(prePayload(root, join(root, 'src/checkout/checkout.ts'), 'write_file'));
    expect(r.code).toBe(2);
    expect(lockChecks()[0]?.body).toMatchObject({ paths: ['src/checkout/checkout.ts'], tool: 'write_file' });
  });

  it('accepts the docs payload shape { event, tool, input } too', async () => {
    server.requests.length = 0;
    const r = await run({ event: 'PreToolUse', session_id: 's', tool: 'write_file', input: { path: 'src/checkout/checkout.ts' } });
    expect(r.code).toBe(2);
  });

  it('allows paths outside the workspace without asking the server', async () => {
    server.requests.length = 0;
    const r = await run(prePayload(root, '/etc/hosts', 'write_file'));
    expect(r.code).toBe(0);
    expect(lockChecks()).toHaveLength(0);
  });

  it('ignores tools that do not edit files', async () => {
    server.requests.length = 0;
    const r = await run({ ...prePayload(root, 'src/checkout/checkout.ts'), tool_name: 'read_file' });
    expect(r.code).toBe(0);
    expect(lockChecks()).toHaveLength(0);
  });

  it('fails open when the server is down (exit 0 in < 1.8 s)', async () => {
    const r = await run(prePayload(root, 'src/checkout/checkout.ts'), { RADAR_SERVER: await deadServerUrl() });
    expect(r.code).toBe(0);
    expect(r.ms).toBeLessThan(1_800);
  });

  it('fails open when the server is slow (3 s → exit 0 in < 1.8 s)', async () => {
    const slow = await startFakeServer(() => ({ json: { decision: 'block', results: [], activeTaskId: null, message: 'x' }, delayMs: 3_000 }));
    try {
      const r = await run(prePayload(root, 'src/checkout/checkout.ts'), { RADAR_SERVER: slow.url });
      expect(r.code).toBe(0);
      expect(r.ms).toBeLessThan(1_800);
    } finally {
      await slow.close();
    }
  });

  it('fails open on an HTTP error from the server', async () => {
    const broken = await startFakeServer(() => ({ status: 500, json: { error: { code: 'internal' } } }));
    try {
      const r = await run(prePayload(root, 'src/checkout/checkout.ts'), { RADAR_SERVER: broken.url });
      expect(r.code).toBe(0);
    } finally {
      await broken.close();
    }
  });

  it('does nothing outside a Radar workspace (no local.json, no env)', async () => {
    const bare = makeWorkspace();
    const r = await runHook(bundles.lock_guard, [], prePayload(bare, 'src/checkout/checkout.ts'), {}, bare);
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).toBe('');
  });

  it('reads server + token from .radar/local.json found from the payload cwd', async () => {
    server.requests.length = 0;
    const ws = makeWorkspace({ server: server.url, workspace: 'toko-demo', member: 'B', token: 'tok-local', role: 'coder' });
    const r = await runHook(bundles.lock_guard, [], prePayload(ws, 'src/checkout/checkout.ts'), {}, '/');
    expect(r.code).toBe(2);
    expect(lockChecks()[0]?.auth).toBe('Bearer tok-local');
  });

  it('never exits with anything but 0 or 2 on garbage input', async () => {
    for (const input of ['', 'not json', '[]', '{"hook_event_name":"PreToolUse"}']) {
      const r = await run(input);
      expect([0, 2]).toContain(r.code);
    }
  });

  it('p95 over 20 runs against a local server stays under 300 ms (NFR-01)', async () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) times.push((await run(prePayload(root, 'src/ui/theme.css'))).ms);
    times.sort((a, b) => a - b);
    const p95 = times[Math.ceil(0.95 * times.length) - 1] ?? Infinity;
    console.log(`lock_guard wall time: p50=${times[9]} ms p95=${p95} ms`);
    expect(p95).toBeLessThan(300);
  }, 30_000);
});
