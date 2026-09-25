#!/usr/bin/env node
// Spike 8: overhead of a `node` hook (NFR-01 target: whole lock check < 300 ms). CommonJS, no dependencies.
//
// usage:
//   node hooks/timing.js <event>        as a Bob hook: record process lifetime (start → exit) to out/timing-*.json
//   node hooks/timing.js --bench <N>    outside Bob: spawn hooks/block_edit.js N times, print p50/p95/max wall ms
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const outDir = process.env.SPIKE_OUT_DIR || path.join(__dirname, '..', 'out');

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function bench(n) {
  const payload = JSON.stringify({
    event: 'PreToolUse',
    session_id: 'ses_bench',
    tool: 'write_file',
    input: { path: 'sandbox/locked.ts', content: 'x' },
  });
  const script = path.join(__dirname, 'block_edit.js');
  const benchOut = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'spike-timing-'));
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const r = spawnSync(process.execPath, [script], {
      input: payload,
      env: { ...process.env, SPIKE_OUT_DIR: benchOut },
    });
    samples.push(performance.now() - t0);
    if (r.status !== 2) throw new Error(`block_edit.js exited ${r.status}, expected 2`);
  }
  fs.rmSync(benchOut, { recursive: true, force: true });
  samples.sort((a, b) => a - b);
  const result = {
    runs: n,
    node: process.version,
    p50: +percentile(samples, 50).toFixed(1),
    p95: +percentile(samples, 95).toFixed(1),
    max: +samples[samples.length - 1].toFixed(1),
  };
  console.log(`block_edit.js spawn: runs=${n} p50=${result.p50}ms p95=${result.p95}ms max=${result.max}ms (${process.version})`);
  return result;
}

function hookMode(event) {
  let stdinRaw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (stdinRaw += c));
  const finish = () => {
    const timestamp = `${Date.now()}-${process.pid}`;
    const record = {
      event: `timing-${event}`,
      timestamp,
      lifetimeMs: +performance.now().toFixed(1), // time since this node process started
      stdinBytes: Buffer.byteLength(stdinRaw),
    };
    try {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, `timing-${event}-${timestamp}.json`), JSON.stringify(record, null, 2));
    } catch (err) {
      process.stderr.write(`spike: could not write timing record: ${err.message}\n`);
    }
    process.exit(0);
  };
  process.stdin.on('end', finish);
  setTimeout(finish, 1000);
}

const args = process.argv.slice(2);
if (args[0] === '--bench') bench(Number(args[1]) || 20);
else hookMode(args[0] || 'unknown');
