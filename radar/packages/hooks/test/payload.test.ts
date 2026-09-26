import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeHookPayload } from '@radar/common';

// Real, redacted Bob IDE 2.2.0 payloads captured in fase 01 (cwd is /Users/demo/toko-demo in every fixture).
const fixtures = resolve(import.meta.dirname, '../../../docs/spike-payloads');
const ROOT = '/Users/demo/toko-demo';
const load = (name: string): unknown => JSON.parse(readFileSync(join(fixtures, name), 'utf8'));

describe('normalizeHookPayload from @radar/common as the hooks use it (real fixtures)', () => {
  it('has a fixture for every hook event', () => {
    const events = new Set(readdirSync(fixtures).map((f) => normalizeHookPayload(load(f), ROOT).event));
    expect([...events].sort()).toEqual(['PostToolUse', 'PreToolUse', 'SessionStart', 'Stop', 'UserPromptSubmit']);
  });

  it.each(['write_file', 'apply_diff', 'search_and_replace', 'insert_content'])('reads tool_input.path for %s', (tool) => {
    const n = normalizeHookPayload(load(`pre-tool-use.${tool}.json`), ROOT);
    expect(n).toMatchObject({ event: 'PreToolUse', tool, sessionId: '0123456789abcdef0123456789abcdef' });
    expect(n.paths).toHaveLength(1);
    expect(n.paths[0]).not.toMatch(/^\//);
  });

  it('gives no paths for commands and MCP tools', () => {
    expect(normalizeHookPayload(load('pre-tool-use.execute_command.json'), ROOT).paths).toEqual([]);
    expect(normalizeHookPayload(load('pre-tool-use.mcp.json'), ROOT)).toMatchObject({ tool: 'mcp__radar-spike__ping', paths: [] });
  });

  it('keeps the prompt text of UserPromptSubmit', () => {
    expect(normalizeHookPayload(load('user-prompt-submit.json'), ROOT).prompt).toMatch(/SPIKE-MARKER/);
  });

  it('accepts the docs shape and camelCase, drops paths outside the root, dedupes', () => {
    expect(normalizeHookPayload({ event: 'PreToolUse', tool: 'write_file', input: { path: 'src/a.ts' } }, ROOT)).toMatchObject({
      event: 'PreToolUse',
      tool: 'write_file',
      paths: ['src/a.ts'],
    });
    expect(
      normalizeHookPayload(
        { hookEventName: 'PreToolUse', toolName: 'apply_diff', toolInput: { files: [{ path: 'a.ts' }, { path: `${ROOT}/a.ts` }, { path: '/etc/x' }] } },
        ROOT,
      ).paths,
    ).toEqual(['a.ts']);
    expect(normalizeHookPayload('garbage', ROOT)).toMatchObject({ event: 'unknown', tool: null, paths: [] });
  });
});
