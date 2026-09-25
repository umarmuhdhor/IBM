#!/usr/bin/env node
// Spike PreToolUse hook (fase 01, spike 1/2/2b/19/20). CommonJS, no dependencies.
// Blocks every edit whose target path ends with `locked.ts`; allows everything else.
//
// usage: node hooks/block_edit.js [--json] [--sleep <seconds>]
//   default   block = message on stderr + exit 2 (the only blocking channel the Bob docs define)
//   --json    block = {"decision":"block","reason":…} on stdout + exit 0 (spike 2b; expected to be ignored)
//   --sleep N wait N seconds before deciding (spike 19, run with a smaller hook `timeout`)
//
// Every call writes out/pre-block-<timestamp>.json with the raw payload and which field held the path.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BLOCK_MESSAGE =
  'SPIKE-BLOCK: locked.ts dipegang Bob milik A (T-1). Jangan coba ulang. Panggil why_blocked.';
const ENV_PREFIXES = ['BOB_', 'HOOK_', 'CLAUDE_'];
const STDIN_TIMEOUT_MS = 1000;

function parseArgs(argv) {
  const opts = { json: false, sleepSeconds: 0 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') opts.json = true;
    else if (argv[i] === '--sleep') opts.sleepSeconds = Number(argv[++i] ?? 0) || 0;
  }
  return opts;
}

function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    const done = () => resolve(raw);
    const timer = setTimeout(done, STDIN_TIMEOUT_MS);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (raw += chunk));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      done();
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      done();
    });
  });
}

// Candidate locations of the target path, in the order fase 01 step A2 asks for.
function findPaths(payload) {
  if (!payload || typeof payload !== 'object') return { field: null, paths: [] };
  const input = payload.input ?? {};
  const toolInput = payload.tool_input ?? {};
  const candidates = [
    ['input.path', input.path],
    ['input.file_path', input.file_path],
    ['input.args.path', input.args && input.args.path],
    ['input.files[].path', Array.isArray(input.files) ? input.files.map((f) => f && f.path) : undefined],
    ['tool_input.path', toolInput.path],
    ['tool_input.file_path', toolInput.file_path],
  ];
  for (const [field, value] of candidates) {
    const paths = (Array.isArray(value) ? value : [value]).filter((p) => typeof p === 'string' && p);
    if (paths.length) return { field, paths };
  }
  return { field: null, paths: [] };
}

function pickEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (ENV_PREFIXES.some((p) => k.startsWith(p))) env[k] = v;
  }
  return env;
}

function writeRecord(record) {
  const outDir = process.env.SPIKE_OUT_DIR || path.join(__dirname, '..', 'out');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, `pre-block-${record.timestamp}.json`),
      JSON.stringify(record, null, 2),
    );
  } catch (err) {
    // Logging must never change the decision; note it on stderr (Bob writes stderr to its log).
    process.stderr.write(`spike: could not write record: ${err.message}\n`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const stdinRaw = await readStdin();
  let stdinJson = null;
  try {
    stdinJson = JSON.parse(stdinRaw);
  } catch {
    stdinJson = null;
  }

  const { field, paths } = findPaths(stdinJson);
  const blocked = paths.some((p) => p.replace(/\\/g, '/').endsWith('locked.ts'));
  const timestamp = `${Date.now()}-${process.pid}`;

  writeRecord({
    event: 'pre-block',
    timestamp,
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    env: pickEnv(),
    envKeys: Object.keys(process.env).sort(),
    stdinRaw,
    stdinJson,
    pathField: field,
    paths,
    decision: blocked ? 'block' : 'allow',
    mode: opts.json ? 'json' : 'exit2',
    sleepSeconds: opts.sleepSeconds,
  });

  if (opts.sleepSeconds > 0) {
    await new Promise((r) => setTimeout(r, opts.sleepSeconds * 1000));
  }

  if (!blocked) process.exit(0);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ decision: 'block', reason: BLOCK_MESSAGE })}\n`);
    process.exit(0);
  }
  process.stderr.write(`${BLOCK_MESSAGE}\n`);
  process.exit(2);
}

main();
