// IN-03 (D-alief-09): the `radar` CLI as one self-contained file for the desktop app, which runs it with its own
// Electron binary (ELECTRON_RUN_AS_NODE=1), so a teammate needs no Node or npm. Unlike bundle.mjs, every runtime
// dependency is inlined. Output: <out>/dist/radar.mjs and <out>/bob-kit (findKitDir looks at ../bob-kit).
// Usage: node scripts/bundle-standalone.mjs <out-dir>
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const outArg = process.argv[2];
if (!outArg) {
  console.error('usage: node scripts/bundle-standalone.mjs <out-dir>');
  process.exit(2);
}
const out = resolve(outArg);
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'dist'), { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('../src/cli.ts', import.meta.url))],
  outfile: join(out, 'dist', 'radar.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // ws and commander are CommonJS: give the ESM bundle a real require for their node:* imports.
  banner: { js: "import { createRequire as __radarCreateRequire } from 'node:module'; const require = __radarCreateRequire(import.meta.url);" },
  // Optional native speedups of ws; it falls back to pure JS without them.
  external: ['bufferutil', 'utf-8-validate'],
  logLevel: 'warning',
});
cpSync(fileURLToPath(new URL('../../../bob-kit', import.meta.url)), join(out, 'bob-kit'), { recursive: true });
console.log(`standalone radar CLI ready: ${out}`);
