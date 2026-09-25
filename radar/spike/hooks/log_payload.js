'use strict';

const fs = require('fs');
const path = require('path');

const event = process.argv[2] || 'unknown';
const timestamp = `${Date.now()}-${process.pid}`;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => {
      process.stdin.destroy();
      resolve(data);
    }, 1000);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function main() {
  const stdinRaw = await readStdin();

  let stdinJson = null;
  try {
    stdinJson = JSON.parse(stdinRaw);
  } catch (_) {
    stdinJson = null;
  }

  const outDir = process.env.SPIKE_OUT_DIR
    ? process.env.SPIKE_OUT_DIR
    : path.join(__dirname, '..', 'out');

  const filteredEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('BOB_') || k.startsWith('HOOK_') || k.startsWith('CLAUDE_')) {
      filteredEnv[k] = v;
    }
  }

  const envKeys = Object.keys(process.env).sort();

  const payload = {
    argv: process.argv,
    env: filteredEnv,
    envKeys,
    cwd: process.cwd(),
    stdinRaw,
    stdinJson,
  };

  const outFile = path.join(outDir, `${event}-${timestamp}.json`);

  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    process.stderr.write(`log_payload write error: ${err.message}\n`);
  }

  process.stdout.write(`SPIKE-MARKER ${event} ${timestamp}\n`);
  process.exit(0);
}

main();
