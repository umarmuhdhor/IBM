// Run: node --test test/  (from radar/spike). No dependencies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'hooks', 'block_edit.js');

function run(payload, args = [], extraEnv = {}) {
  const outDir = mkdtempSync(join(tmpdir(), 'spike-out-'));
  const res = spawnSync('node', [script, ...args], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    env: { ...process.env, SPIKE_OUT_DIR: outDir, ...extraEnv },
    encoding: 'utf8',
    timeout: 5000,
  });
  const files = readdirSync(outDir);
  const record = files.length ? JSON.parse(readFileSync(join(outDir, files[0]), 'utf8')) : null;
  return { ...res, outDir, files, record };
}

const docsShape = (path) => ({
  event: 'PreToolUse',
  session_id: 'ses_test',
  tool: 'write_file',
  input: { path, content: 'x' },
});

test('blocks locked.ts with exit 2 and a message on stderr (docs shape input.path)', () => {
  const r = run(docsShape('sandbox/locked.ts'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^SPIKE-BLOCK: locked\.ts dipegang Bob milik A \(T-1\)/);
  assert.equal(r.record.decision, 'block');
  assert.equal(r.record.pathField, 'input.path');
});

test('allows other files with exit 0', () => {
  const r = run(docsShape('sandbox/a.ts'));
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
  assert.equal(r.record.decision, 'allow');
});

for (const [label, payload] of [
  ['input.file_path', { tool: 'apply_diff', input: { file_path: '/abs/sandbox/locked.ts' } }],
  ['input.args.path', { tool: 'apply_diff', input: { args: { path: 'sandbox/locked.ts' } } }],
  ['input.files[].path', { tool: 'apply_diff', input: { files: [{ path: 'sandbox/a.ts' }, { path: 'sandbox/locked.ts' }] } }],
  ['tool_input.path', { tool_name: 'write_file', tool_input: { path: 'sandbox/locked.ts' } }],
  ['tool_input.file_path', { tool_name: 'write_file', tool_input: { file_path: 'sandbox/locked.ts' } }],
]) {
  test(`finds the path in ${label}`, () => {
    const r = run(payload);
    assert.equal(r.status, 2);
    assert.equal(r.record.pathField, label);
  });
}

test('--json prints a JSON decision on stdout and exits 0', () => {
  const r = run(docsShape('sandbox/locked.ts'), ['--json']);
  assert.equal(r.status, 0);
  const decision = JSON.parse(r.stdout.trim());
  assert.equal(decision.decision, 'block');
  assert.match(decision.reason, /locked\.ts/);
});

test('--sleep delays before blocking', () => {
  const t0 = Date.now();
  const r = run(docsShape('sandbox/locked.ts'), ['--sleep', '1']);
  assert.equal(r.status, 2);
  assert.ok(Date.now() - t0 >= 1000);
});

test('unparseable stdin is recorded and allowed (fail-open)', () => {
  const r = run('not json');
  assert.equal(r.status, 0);
  assert.equal(r.record.stdinJson, null);
  assert.equal(r.record.stdinRaw, 'not json');
});

test('records only BOB_/HOOK_/CLAUDE_ env values, but all env key names', () => {
  const r = run(docsShape('sandbox/a.ts'), [], { BOB_X: '1', OTHER_Y: '2' });
  assert.equal(r.record.env.BOB_X, '1');
  assert.equal(r.record.env.OTHER_Y, undefined);
  assert.ok(r.record.envKeys.includes('OTHER_Y'));
});
