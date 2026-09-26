import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';
import { workspaceAlias } from '../../vitest.shared';

// Worker tests run inside workerd (D-007): the real Durable Object + SQLite, requests through
// `exports.default.fetch()` or a DO stub. Storage is isolated per test file, so tests use a unique DO name.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { ADMIN_SECRET: 'test', GITHUB_COMMIT: 'false' } },
    }),
  ],
  resolve: { alias: workspaceAlias },
});
