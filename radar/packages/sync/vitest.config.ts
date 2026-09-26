import { defineConfig } from 'vitest/config';
import { workspaceAlias } from '../../vitest.shared';

export default defineConfig({
  resolve: { alias: workspaceAlias },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Integration tests boot the real Worker with wrangler's createTestHarness.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
