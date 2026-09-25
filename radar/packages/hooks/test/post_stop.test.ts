import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bundleHooks, makeWorkspace, runHook, startFakeServer, type FakeServer, type HookName } from './helpers.js';

let bundles: Record<HookName, string>;
let server: FakeServer;
let root: string;
let env: Record<string, string>;

beforeAll(async () => {
  bundles = await bundleHooks();
  server = await startFakeServer();
  root = makeWorkspace();
  env = { RADAR_SERVER: server.url, RADAR_TOKEN: 'tok-b', RADAR_ROOT: root, RADAR_MEMBER: 'B', RADAR_ROLE: 'coder' };
}, 30_000);

afterAll(async () => {
  await server?.close();
});

beforeEach(() => {
  server.requests.length = 0;
});

const post = (tool: string, input: Record<string, unknown>, response = 'ok') => ({
  session_id: 'sess-1',
  cwd: root,
  hook_event_name: 'PostToolUse',
  tool_name: tool,
  tool_input: input,
  tool_response: response,
  tool_use_id: 'tooluse_EXAMPLE',
});
const activity = () => server.requests.filter((q) => q.path === '/v1/bob/activity').map((q) => q.body);

describe('mark_ai_edit (PostToolUse, JT-01)', () => {
  it('reports tool.post with path and linesChanged for write_file, prints nothing', async () => {
    const r = await runHook(bundles.mark_ai_edit, [], post('write_file', { path: 'src/a.ts', content: 'a\nb\nc\n', line_count: 3 }), env, root);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
    expect(activity()).toEqual([
      expect.objectContaining({ kind: 'tool.post', tool: 'write_file', paths: ['src/a.ts'], linesChanged: 3, mode: 'coder' }),
    ]);
  });

  it('counts changed lines of an apply_diff (REPLACE side)', async () => {
    const diff = '<<<<<<< SEARCH\n:start_line:1\n-------\nold\n=======\nnew1\nnew2\n>>>>>>> REPLACE';
    await runHook(bundles.mark_ai_edit, [], post('apply_diff', { path: 'src/a.ts', diff }), env, root);
    expect(activity()[0]).toMatchObject({ tool: 'apply_diff', paths: ['src/a.ts'], linesChanged: 2 });
  });

  it('marks AI edits for edit tools (P1, POST /v1/ai-edits, failure is silent)', async () => {
    await runHook(bundles.mark_ai_edit, [], post('insert_content', { path: 'src/a.ts', line: 1, content: '// i\n' }), env, root);
    const mark = server.requests.find((q) => q.path === '/v1/ai-edits');
    expect(mark?.body).toMatchObject({ paths: ['src/a.ts'], tool: 'insert_content', sessionId: 'sess-1' });
  });

  it('reports reads and commands without file content', async () => {
    await runHook(bundles.mark_ai_edit, [], post('read_file', { path: 'src/a.ts' }, 'SECRET FILE BODY'), env, root);
    await runHook(bundles.mark_ai_edit, [], post('execute_command', { command: 'pnpm test' }, 'lots of output'), env, root);
    const [read, cmd] = activity();
    expect(read).toMatchObject({ kind: 'tool.post', tool: 'read_file', paths: ['src/a.ts'] });
    expect(cmd).toMatchObject({ kind: 'tool.post', tool: 'execute_command', paths: [] });
    expect(JSON.stringify(activity())).not.toContain('SECRET FILE BODY');
    expect(JSON.stringify(activity())).not.toContain('lots of output');
    expect(server.requests.some((q) => q.path === '/v1/ai-edits')).toBe(false);
  });

  it("skips the radar MCP server's own tools", async () => {
    await runHook(bundles.mark_ai_edit, [], post('mcp__radar__why_blocked', {}), env, root);
    expect(activity()).toHaveLength(0);
  });
});

describe('stop (Stop)', () => {
  it('reports turn.end with the session id only, prints nothing, exits 0', async () => {
    const r = await runHook(
      bundles.stop,
      [],
      { session_id: 'sess-1', cwd: root, hook_event_name: 'Stop', last_assistant_message: 'Selesai. Rahasia di sini.' },
      env,
      root,
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
    expect(activity()).toEqual([expect.objectContaining({ kind: 'turn.end', sessionId: 'sess-1', mode: 'coder' })]);
    expect(JSON.stringify(activity())).not.toContain('Rahasia');
  });

  it('never releases locks (no lock endpoints called)', async () => {
    await runHook(bundles.stop, [], { session_id: 's', cwd: root, hook_event_name: 'Stop' }, env, root);
    expect(server.requests.every((q) => q.path === '/v1/bob/activity')).toBe(true);
  });
});
