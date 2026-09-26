// Single-file CLI for `radar-cli.tgz` (fase 04 v0.3, fase 11): @radar/common is inlined because it is not
// published to npm; the other runtime deps stay external and are installed from package.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
await build({
  entryPoints: [fileURLToPath(new URL('../src/cli.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../dist/radar.mjs', import.meta.url)),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: Object.keys(pkg.dependencies ?? {}),
  logLevel: 'warning',
});
