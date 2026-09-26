// Contract test: the bundled hooks against the fase 02 mock server (radar/scripts/mock-server.ts), which validates
// every request with the @radar/common zod schemas. The demo scenario is applied at boot: A holds
// src/checkout/checkout.ts for T-1, B holds src/ui/theme.css for T-2 (radar/scripts/mock-scenarios/demo.json).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMockServer, type MockServer } from '../../../scripts/mock-server.js';
import { bundleHooks, makeWorkspace, prePayload, runHook, type HookName } from './helpers.js';

let bundles: Record<HookName, string>;
let mock: MockServer;
let root: string;

beforeAll(async () => {
  bundles = await bundleHooks();
  mock = await startMockServer({ port: 0, scenario: 'demo', instant: true });
  root = makeWorkspace({ server: `http://127.0.0.1:${mock.port}`, workspace: 'toko-demo', member: 'B', token: 'tok-b', role: 'coder' });
}, 30_000);

afterAll(async () => {
  await mock.close();
});

const hookLog = () => (existsSync(join(root, '.radar', 'hook.log')) ? readFileSync(join(root, '.radar', 'hook.log'), 'utf8') : '');
const activityOf = (memberId: string) =>
  mock.hub.events.filter((e) => e.type === 'bob.activity' && (e.payload as { memberId?: string }).memberId === memberId);

describe('hooks against the fase 02 mock server', () => {
  it('lock_guard blocks B on a file A holds, with the server message on stderr (exit 2)', async () => {
    const r = await runHook(bundles.lock_guard, [], prePayload(root, 'src/checkout/checkout.ts'), {}, root);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('src/checkout/checkout.ts');
    expect(r.stderr).toContain('Andi');
    expect(r.stderr).toContain('T-1');
  });

  it('lock_guard allows B on its own file (exit 0)', async () => {
    const r = await runHook(bundles.lock_guard, [], prePayload(root, 'src/ui/theme.css'), {}, root);
    expect(r.code).toBe(0);
    expect(r.stderr).toBe('');
  });

  it('lock_guard reads apply_diff multi-file args.file given as a single object', async () => {
    const payload = {
      ...prePayload(root, 'unused'),
      tool_input: { args: { file: { path: join(root, 'src/checkout/checkout.ts'), diff: 'x' } } },
    };
    const r = await runHook(bundles.lock_guard, [], payload, {}, root);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('src/checkout/checkout.ts');
  });

  it('brief start prints the brief for B', async () => {
    const r = await runHook(
      bundles.brief,
      ['start'],
      { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' },
      {},
      root,
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('T-2');
  });

  it('mark_ai_edit bodies (bob.activity tool.post + ai-edits) pass the server schema', async () => {
    const before = activityOf('B').length;
    const post = { ...prePayload(root, 'src/ui/theme.css'), hook_event_name: 'PostToolUse', tool_response: 'ok' };
    const r = await runHook(bundles.mark_ai_edit, [], post, {}, root);
    expect(r.code).toBe(0);
    const posts = activityOf('B').slice(before).filter((e) => (e.payload as { kind: string }).kind === 'tool.post');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.payload).toMatchObject({ tool: 'apply_diff', paths: ['src/ui/theme.css'], linesChanged: 1 });
    expect(hookLog()).not.toMatch(/not sent/);
  });

  it('every bob.activity body the hooks send passes the server schema', async () => {
    const before = activityOf('B').length;
    await runHook(bundles.lock_guard, [], prePayload(root, 'src/ui/Header.tsx'), {}, root);
    await runHook(bundles.stop, [], { session_id: 's1', cwd: root, hook_event_name: 'Stop' }, {}, root);
    const kinds = activityOf('B')
      .slice(before)
      .map((e) => (e.payload as { kind: string }).kind);
    expect(kinds).toEqual(expect.arrayContaining(['tool.pre', 'turn.end']));
    expect(hookLog()).not.toMatch(/not sent/);
  });
});
