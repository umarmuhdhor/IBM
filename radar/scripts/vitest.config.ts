import { defineConfig } from 'vitest/config';
import { workspaceAlias } from '../vitest.shared.js';

// sim-3pc.test.ts imports the sync agent, which imports @radar/common: resolve it from source so CI can
// run `pnpm test` before `pnpm build`.
export default defineConfig({
  resolve: { alias: workspaceAlias },
});
