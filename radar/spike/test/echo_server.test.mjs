// Run: node --test test/*.test.mjs (from radar/spike). No dependencies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const server = join(dirname(fileURLToPath(import.meta.url)), '..', 'mcp', 'echo-server.mjs');

function session(messages) {
  const res = spawnSync('node', [server], {
    input: messages.map((m) => JSON.stringify({ jsonrpc: '2.0', ...m })).join('\n') + '\n',
    env: { ...process.env, RADAR_ROLE: 'coder', SPIKE_OUT_DIR: mkdtempSync(join(tmpdir(), 'spike-mcp-')) },
    encoding: 'utf8',
    timeout: 5000,
  });
  return res.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('initialize → tools/list → tools/call ping', () => {
  const [init, list, call] = session([
    { id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { method: 'notifications/initialized' },
    { id: 2, method: 'tools/list' },
    { id: 3, method: 'tools/call', params: { name: 'ping', arguments: { note: 'halo' } } },
  ]);
  assert.equal(init.id, 1);
  assert.equal(init.result.serverInfo.name, 'radar-spike');
  assert.deepEqual(list.result.tools.map((t) => t.name), ['ping']);
  assert.match(call.result.content[0].text, /^pong halo role=coder cwd=\//);
});

test('unknown tool and unknown method return JSON-RPC errors', () => {
  const [badTool, badMethod] = session([
    { id: 1, method: 'tools/call', params: { name: 'nope', arguments: {} } },
    { id: 2, method: 'nope/nope' },
  ]);
  assert.equal(badTool.error.code, -32602);
  assert.equal(badMethod.error.code, -32601);
});
