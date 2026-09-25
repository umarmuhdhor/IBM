import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EDIT_TOOLS_REGEX } from './constants.js';
import { normalizeHookPayload } from './hook-payload.js';

const ROOT = '/Users/demo/toko-demo';
const fixtureDir = fileURLToPath(new URL('../../../docs/spike-payloads/', import.meta.url));
const fixture = (name: string): unknown => JSON.parse(readFileSync(`${fixtureDir}${name}`, 'utf8'));

describe('normalizeHookPayload — real Bob IDE 2.2.0 fixtures (fase 01)', () => {
  it('every fixture has a known event and the fixture session id', () => {
    const files = readdirSync(fixtureDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const f of files) {
      const h = normalizeHookPayload(fixture(f), ROOT);
      expect(h.event, f).not.toBe('unknown');
      expect(h.sessionId, f).toBe('0123456789abcdef0123456789abcdef');
      expect(h.cwd, f).toBe(ROOT);
    }
  });

  it.each([
    ['pre-tool-use.apply_diff.json', 'apply_diff', ['sandbox/locked.ts']],
    ['pre-tool-use.insert_content.json', 'insert_content', ['sandbox/a.ts']],
    ['pre-tool-use.search_and_replace.json', 'search_and_replace', ['sandbox/a.ts']],
    ['pre-tool-use.write_file.json', 'write_file', ['.bob/custom_modes.yaml']],
  ])('PreToolUse %s → tool %s, paths %j', (file, tool, paths) => {
    const h = normalizeHookPayload(fixture(file), ROOT);
    expect(h.event).toBe('PreToolUse');
    expect(h.tool).toBe(tool);
    expect(EDIT_TOOLS_REGEX.test(h.tool ?? '')).toBe(true);
    expect(h.paths).toEqual(paths);
  });

  it('PostToolUse keeps tool_input but exposes it only as input/raw', () => {
    const h = normalizeHookPayload(fixture('post-tool-use.write_file.json'), ROOT);
    expect(h.event).toBe('PostToolUse');
    expect(h.paths).toEqual(['hooks/log_payload.js']);
    expect(h.input.line_count).toBe(64);
  });

  it('non-edit tools carry no paths (mcp, spawn_subagent, execute_command)', () => {
    for (const f of ['pre-tool-use.mcp.json', 'pre-tool-use.spawn_subagent.json', 'pre-tool-use.execute_command.json']) {
      const h = normalizeHookPayload(fixture(f), ROOT);
      expect(h.paths, f).toEqual([]);
      expect(EDIT_TOOLS_REGEX.test(h.tool ?? ''), f).toBe(false);
    }
  });

  it('UserPromptSubmit exposes the prompt; SessionStart and Stop have none', () => {
    expect(normalizeHookPayload(fixture('user-prompt-submit.json'), ROOT).prompt).toMatch(/^Sebutkan/);
    expect(normalizeHookPayload(fixture('session-start.json'), ROOT).event).toBe('SessionStart');
    const stop = normalizeHookPayload(fixture('stop.json'), ROOT);
    expect(stop.event).toBe('Stop');
    expect(stop.prompt).toBeNull();
  });
});

describe('normalizeHookPayload — other shapes (BC-04)', () => {
  it('accepts the docs shape { event, tool, input }', () => {
    const h = normalizeHookPayload({ event: 'PreToolUse', tool: 'write_file', input: { path: 'src/a.ts' } }, ROOT);
    expect(h).toMatchObject({ event: 'PreToolUse', tool: 'write_file', paths: ['src/a.ts'], sessionId: null });
  });

  it('accepts camelCase keys', () => {
    const h = normalizeHookPayload(
      { hookEventName: 'PreToolUse', toolName: 'apply_diff', toolInput: { filePath: 'src/b.ts' }, sessionId: 's1' },
      ROOT,
    );
    expect(h).toMatchObject({ event: 'PreToolUse', tool: 'apply_diff', paths: ['src/b.ts'], sessionId: 's1' });
  });

  it('collects every path field, converts absolute and Windows-style paths, and dedupes', () => {
    const h = normalizeHookPayload(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'apply_diff',
        tool_input: {
          path: 'src\\checkout\\checkout.ts',
          file_path: `${ROOT}/src/checkout/checkout.ts`,
          target_file: './src/utils.ts',
          files: [{ path: 'src/a.ts' }],
          args: { path: 'src/b.ts', file: [{ path: 'src/c.ts', diff: '…' }, { path: 'src/a.ts' }] },
        },
      },
      ROOT,
    );
    expect(h.paths).toEqual(['src/checkout/checkout.ts', 'src/utils.ts', 'src/a.ts', 'src/b.ts', 'src/c.ts']);
  });

  it('accepts a single args.file object', () => {
    const h = normalizeHookPayload({ event: 'PreToolUse', tool: 'apply_diff', input: { args: { file: { path: 'x.ts' } } } }, ROOT);
    expect(h.paths).toEqual(['x.ts']);
  });

  it('drops paths outside the workspace instead of throwing', () => {
    const h = normalizeHookPayload(
      { hook_event_name: 'PreToolUse', tool_name: 'write_file', tool_input: { path: '/etc/hosts' } },
      ROOT,
    );
    expect(h.paths).toEqual([]);
    expect(h.droppedPaths).toEqual(['/etc/hosts']);
  });

  it('returns an unknown event for garbage input', () => {
    for (const raw of [null, 42, 'x', [], { hook_event_name: 'Nope' }]) {
      const h = normalizeHookPayload(raw, ROOT);
      expect(h.event).toBe('unknown');
      expect(h.paths).toEqual([]);
      expect(h.tool).toBeNull();
    }
  });
});
