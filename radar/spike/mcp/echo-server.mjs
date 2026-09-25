#!/usr/bin/env node
// Spike 6/18: minimal MCP stdio server, hand-written JSON-RPC 2.0 (newline-delimited), no dependencies.
// Tool: ping({ note }) → "pong <note> role=<RADAR_ROLE> cwd=<cwd>".
// Every request is appended to out/mcp-<pid>.jsonl so we can see what Bob sends and from which cwd.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const PROTOCOL_VERSION = '2025-06-18';
const outDir = process.env.SPIKE_OUT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'out');
const logFile = join(outDir, `mcp-${process.pid}.jsonl`);

function log(entry) {
  try {
    mkdirSync(outDir, { recursive: true });
    appendFileSync(logFile, `${JSON.stringify({ t: Date.now(), ...entry })}\n`);
  } catch {
    // stdout is the protocol channel; never write diagnostics there.
  }
}

const PING_TOOL = {
  name: 'ping',
  description: 'Spike echo tool. Returns "pong <note> role=<role> cwd=<cwd>".',
  inputSchema: {
    type: 'object',
    properties: { note: { type: 'string', description: 'Any short text to echo back' } },
    required: ['note'],
  },
};

function send(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
}

function handle(req) {
  const { id, method, params } = req;
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'radar-spike', version: '0.0.1' },
      };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: [PING_TOOL] };
    case 'tools/call': {
      if (params?.name !== 'ping') {
        throw Object.assign(new Error(`unknown tool: ${params?.name}`), { code: -32602 });
      }
      const note = String(params.arguments?.note ?? '');
      const text = `pong ${note} role=${process.env.RADAR_ROLE ?? 'unset'} cwd=${process.cwd()}`;
      return { content: [{ type: 'text', text }] };
    }
    default:
      if (id === undefined) return undefined; // notification (e.g. notifications/initialized)
      throw Object.assign(new Error(`method not found: ${method}`), { code: -32601 });
  }
}

log({ kind: 'start', cwd: process.cwd(), argv: process.argv.slice(2), role: process.env.RADAR_ROLE ?? null });

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    send({ id: null, error: { code: -32700, message: 'parse error' } });
    return;
  }
  log({ kind: 'request', method: req.method, params: req.params ?? null });
  try {
    const result = handle(req);
    if (req.id !== undefined && result !== undefined) send({ id: req.id, result });
  } catch (err) {
    if (req.id !== undefined) send({ id: req.id, error: { code: err.code ?? -32603, message: err.message } });
  }
});
rl.on('close', () => process.exit(0));
