import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bundleHooks,
  deadServerUrl,
  makeWorkspace,
  runHook,
  startFakeServer,
  type FakeServer,
  type HookName,
} from './helpers.js';

const START_LINES = [
  '[Radar] Kamu B (coder). Task aktif: T-2 Dark mode (dikerjakan).',
  '[Radar] File kamu: src/ui/theme.css, src/ui/Header.tsx',
  '[Radar] Dipegang orang lain: src/checkout/checkout.ts→A(T-1)',
  '[Radar] Menunggu PM: src/routes.ts (R-4).',
  '[Radar] Catatan PM: calculateTotal() kini butuh parameter ongkir.',
  '[Radar] Jangan edit file milik orang lain. Kalau ditolak: radar why_blocked.',
  '[Radar] extra line 7 that must be dropped',
  '[Radar] extra line 8 that must be dropped',
];

let bundles: Record<HookName, string>;
let server: FakeServer;
let root: string;
let env: Record<string, string>;
let promptLines: string[] = [];

beforeAll(async () => {
  bundles = await bundleHooks();
  server = await startFakeServer((req) => {
    if (req.path.startsWith('/v1/brief?kind=start')) return { json: { lines: START_LINES, cursor: 100 } };
    if (req.path.startsWith('/v1/brief?kind=prompt')) return { json: { lines: promptLines, cursor: 120 } };
    return undefined;
  });
  env = { RADAR_SERVER: server.url, RADAR_TOKEN: 'tok-b', RADAR_MEMBER: 'B', RADAR_ROLE: 'coder' };
}, 30_000);

afterAll(async () => {
  await server?.close();
});

beforeEach(() => {
  server.requests.length = 0;
  promptLines = [];
  root = makeWorkspace();
});

const startPayload = () => ({ session_id: 'sess-1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' });
const promptPayload = (prompt: string) => ({ session_id: 'sess-1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt });
const run = (arg: 'start' | 'prompt', payload: unknown, extra: Record<string, string> = {}) =>
  runHook(bundles.brief, [arg], payload, { ...env, RADAR_ROOT: root, ...extra }, root);
const cursor = () =>
  (JSON.parse(readFileSync(join(root, '.radar', 'state.json'), 'utf8')) as { briefCursor?: number }).briefCursor;

describe('brief start (SessionStart, BC-02)', () => {
  it('prints at most 6 lines from GET /v1/brief?kind=start and saves the cursor', async () => {
    const r = await run('start', startPayload());
    expect(r.code).toBe(0);
    const lines = r.stdout.trimEnd().split('\n');
    expect(lines).toEqual(START_LINES.slice(0, 6));
    expect(server.requests.some((q) => q.path === '/v1/brief?kind=start' && q.auth === 'Bearer tok-b')).toBe(true);
    expect(cursor()).toBe(100);
  });

  it('reports session.start with the mode (JT-01)', async () => {
    await run('start', startPayload());
    const a = server.requests.find((q) => q.path === '/v1/bob/activity');
    expect(a?.body).toMatchObject({ kind: 'session.start', sessionId: 'sess-1', mode: 'coder' });
  });
});

describe('brief prompt (UserPromptSubmit, BC-03)', () => {
  it('asks only for what changed since the saved cursor and prints nothing when there is nothing new', async () => {
    await run('start', startPayload());
    server.requests.length = 0;
    const r = await run('prompt', promptPayload('lanjutkan'));
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
    expect(server.requests.some((q) => q.path === '/v1/brief?kind=prompt&since=100')).toBe(true);
    expect(cursor()).toBe(120);
  });

  it('prints the new lines (block, PM decision, changed files)', async () => {
    promptLines = [
      '[Radar] Edit src/checkout/checkout.ts DITOLAK: dipegang Alice (T-1). Jangan coba ulang, jangan lewat shell.',
      '[Radar] Keputusan PM: kamu antre src/checkout/checkout.ts setelah T-1.',
    ];
    const r = await run('prompt', promptPayload('lanjutkan'));
    expect(r.stdout.trimEnd().split('\n')).toEqual(promptLines);
  });

  it('without a saved cursor asks with since=0', async () => {
    await run('prompt', promptPayload('halo'));
    expect(server.requests.some((q) => q.path === '/v1/brief?kind=prompt&since=0')).toBe(true);
  });

  it('does not send the prompt text when shareprompts is off (JT-03)', async () => {
    await run('prompt', promptPayload('rahasia: tambah kupon'));
    const a = server.requests.find((q) => q.path === '/v1/bob/activity');
    expect(a?.body).toMatchObject({ kind: 'prompt', sessionId: 'sess-1' });
    expect((a?.body as { text?: string }).text).toBeUndefined();
  });

  it('sends at most 200 chars of prompt text when shareprompts is on', async () => {
    await run('prompt', promptPayload('x'.repeat(500)), { RADAR_SHAREPROMPTS: 'true' });
    const a = server.requests.find((q) => q.path === '/v1/bob/activity');
    expect((a?.body as { text: string }).text.length).toBeLessThanOrEqual(200);
  });
});

describe('brief fail-open', () => {
  it('prints nothing and exits 0 when the server is down', async () => {
    const r = await run('start', startPayload(), { RADAR_SERVER: await deadServerUrl() });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.ms).toBeLessThan(1_800);
  });

  it('prints nothing outside a Radar workspace', async () => {
    const bare = makeWorkspace();
    const r = await runHook(bundles.brief, ['start'], { hook_event_name: 'SessionStart', cwd: bare }, {}, bare);
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).toBe('');
  });
});
