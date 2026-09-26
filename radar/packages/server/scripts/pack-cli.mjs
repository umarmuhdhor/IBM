// IN-03 (D-alief-09): builds the `radar` CLI tarball (bob-kit included) into public/radar-cli.tgz, which the
// Worker serves as a static asset for `curl <server>/j/<code> | sh`. Runs before every `pnpm deploy`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const syncDir = fileURLToPath(new URL('../../sync', import.meta.url));
const out = fileURLToPath(new URL('../public/radar-cli.tgz', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'radar-cli-'));
try {
  execFileSync('pnpm', ['pack', '--pack-destination', tmp], {
    cwd: syncDir,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  if (!tgz) throw new Error('pnpm pack produced no .tgz');
  renameSync(join(tmp, tgz), out);
  console.log(`radar-cli.tgz ready: ${out}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
