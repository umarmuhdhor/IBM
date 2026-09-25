import path from 'node:path';
import type { NextConfig } from 'next';

// Static export for Cloudflare Pages (R1 §3). @radar/ui ships source; @radar/common resolves to its
// dist/ at build time, so build dependencies first: `pnpm --filter "@radar/web..." build`.
const nextConfig: NextConfig = {
  output: 'export',
  // radar/ is its own pnpm workspace; pin the root so Next ignores lockfiles further up.
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@radar/common', '@radar/ui'],
  // Lint runs once for the whole workspace (`pnpm -C radar lint`).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
