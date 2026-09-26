// The main entry must stay free of Node built-ins: the Worker (fase 03) and the bundled hooks import it.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('./', import.meta.url));
const NODE_ONLY = new Set(['config.ts', 'node.ts']);

describe('@radar/common entry purity', () => {
  it('no source outside config.ts/node.ts imports node:* or process', () => {
    const offenders = readdirSync(srcDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !NODE_ONLY.has(f))
      .filter((f) => {
        const text = readFileSync(`${srcDir}${f}`, 'utf8');
        return /from\s+['"]node:/.test(text) || /\bprocess\./.test(text);
      });
    expect(offenders).toEqual([]);
  });

  it('bundles for a neutral platform (Workers) without Node built-ins', async () => {
    const out = await build({
      entryPoints: [`${srcDir}index.ts`],
      bundle: true,
      write: false,
      platform: 'neutral',
      format: 'esm',
      mainFields: ['module', 'main'],
      logLevel: 'silent',
    });
    expect(out.errors).toEqual([]);
    const code = out.outputFiles[0]!.text;
    expect(code).not.toMatch(/from\s*["']node:/);
  });

  it('bundles to a single CJS file for the hooks (fase 07)', async () => {
    const out = await build({
      entryPoints: [`${srcDir}node.ts`],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      target: 'node20',
      logLevel: 'silent',
    });
    expect(out.errors).toEqual([]);
    expect(out.outputFiles[0]!.text).toContain('loadLocalConfig');
  });
});
