// Fase 10 (lane Core): thin entry for `pnpm -C radar sim` (see plan/fase-10-integrasi-e2e.md).
// The runner lives in packages/sync/scripts/sim-3pc.ts next to bench-sync.ts: the `wrangler`
// symlink in radar/node_modules is broken under pnpm 12 (D-alief-04 point 9), so anything that
// imports `createTestHarness` must resolve it from a package that depends on wrangler.
import { main, runSim } from '../packages/sync/scripts/sim-3pc.js';
import { pathToFileURL } from 'node:url';

export { runSim, main };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
