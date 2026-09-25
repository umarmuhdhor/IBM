import { fileURLToPath } from 'node:url';

// Tests consume workspace packages as source (same idea as the Orca app alias, R1 §2),
// so `pnpm test` does not need a prior `pnpm build`.
const src = (pkg: string) =>
  fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export const workspaceAlias = {
  '@radar/common': src('common'),
  '@radar/ui': src('ui'),
};
