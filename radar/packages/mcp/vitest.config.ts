import { defineConfig } from 'vitest/config';
import { workspaceAlias } from '../../vitest.shared';

export default defineConfig({
  resolve: { alias: workspaceAlias },
  test: {
    // server.int.test.ts boots the real Worker with wrangler's createTestHarness.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
