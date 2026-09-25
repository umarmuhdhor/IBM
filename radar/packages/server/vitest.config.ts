import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';
import { workspaceAlias } from '../../vitest.shared';

// Worker tests run inside workerd (D-007): requests go through `exports.default.fetch()`.
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  resolve: { alias: workspaceAlias },
});
