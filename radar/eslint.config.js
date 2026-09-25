// Flat config for the radar workspace (R5 §1). Orca code in ../app uses its own oxlint setup.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.next/**',
      '**/.wrangler/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'examples/**',
      'spike/**',
      'bob-kit/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'packages/*/src/**/*.{ts,tsx}',
      'packages/*/test/**/*.ts',
      'packages/web/app/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
);
