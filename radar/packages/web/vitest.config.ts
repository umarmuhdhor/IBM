import { defineConfig } from 'vitest/config';
import { workspaceAlias } from '../../vitest.shared';

export default defineConfig({
  resolve: { alias: workspaceAlias },
  test: { environment: 'jsdom', css: false, exclude: ['**/node_modules/**', 'e2e/**'] },
});
