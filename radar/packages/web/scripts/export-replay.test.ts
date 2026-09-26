// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { run } from './export-replay.js';

const OUT = fileURLToPath(new URL('../public/demo/', import.meta.url));

describe('export-replay run()', () => {
  it('writes events.json, meta.json and bob-quotes.json from the local fixture', async () => {
    await run();

    expect(existsSync(`${OUT}events.json`)).toBe(true);
    expect(existsSync(`${OUT}meta.json`)).toBe(true);
    expect(existsSync(`${OUT}bob-quotes.json`)).toBe(true);

    const events = JSON.parse(readFileSync(`${OUT}events.json`, 'utf8'));
    expect(events.workspace).toBe('toko-demo');
    expect(events.events.length).toBeGreaterThan(0);

    const meta = JSON.parse(readFileSync(`${OUT}meta.json`, 'utf8'));
    expect(meta.chapters.map((c: { id: string }) => c.id)).toContain('near-miss');
    expect(meta.metrics.nearMisses).toBeGreaterThan(0);
    expect(meta.links.repoUrl).toMatch(/^https:\/\/github\.com\//);

    const quotes = JSON.parse(readFileSync(`${OUT}bob-quotes.json`, 'utf8'));
    expect(quotes.bob_after_block).toBeDefined();
  });

  it('never leaks a secret-shaped token into the written events.json', async () => {
    await run();
    const raw = readFileSync(`${OUT}events.json`, 'utf8');
    expect(raw).not.toMatch(/rdr_|ghp_|sk-/);
  });
});
