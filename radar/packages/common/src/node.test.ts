import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigInvalidError, ConfigMissingError, createIgnoreMatcher, loadLocalConfig, loadState, saveState } from './node.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'radar-common-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const writeLocal = (dir: string, body: unknown) => {
  mkdirSync(join(dir, '.radar'), { recursive: true });
  writeFileSync(join(dir, '.radar', 'local.json'), typeof body === 'string' ? body : JSON.stringify(body));
};

describe('loadLocalConfig', () => {
  it('walks up to the nearest .radar/local.json', () => {
    writeLocal(root, { server: 'http://localhost:8787/', workspace: 'toko-demo', member: 'A', token: 'tok-a' });
    const deep = join(root, 'src', 'checkout');
    mkdirSync(deep, { recursive: true });
    const cfg = loadLocalConfig(deep, {});
    expect(cfg).toEqual({
      root,
      server: 'http://localhost:8787',
      workspace: 'toko-demo',
      member: 'A',
      token: 'tok-a',
      role: 'coder',
      shareprompts: false,
    });
  });

  it('lets RADAR_* env override the file', () => {
    writeLocal(root, { server: 'http://file', token: 'tok-file', role: 'coder' });
    const cfg = loadLocalConfig(root, { RADAR_SERVER: 'http://env', RADAR_TOKEN: 'tok-env', RADAR_ROLE: 'pm', RADAR_SHAREPROMPTS: 'true' });
    expect(cfg).toMatchObject({ server: 'http://env', token: 'tok-env', role: 'pm', shareprompts: true });
  });

  it('works from env only (RADAR_ROOT)', () => {
    const cfg = loadLocalConfig('/', { RADAR_ROOT: root, RADAR_SERVER: 'http://env', RADAR_TOKEN: 't' });
    expect(cfg.root).toBe(root);
  });

  it('throws ConfigMissingError without server or token', () => {
    expect(() => loadLocalConfig(root, {})).toThrow(ConfigMissingError);
  });

  it('throws ConfigInvalidError for broken JSON, wrong types or an invalid role', () => {
    writeLocal(root, '{nope');
    expect(() => loadLocalConfig(root, {})).toThrow(ConfigInvalidError);
    writeLocal(root, { server: 'http://x', token: 5 });
    expect(() => loadLocalConfig(root, {})).toThrow(ConfigInvalidError);
    writeLocal(root, { server: 'http://x', token: 't' });
    expect(() => loadLocalConfig(root, { RADAR_ROLE: 'admin' })).toThrow(ConfigInvalidError);
  });
});

describe('hook state', () => {
  it('returns {} when missing or corrupt', () => {
    expect(loadState(root)).toEqual({});
    mkdirSync(join(root, '.radar'));
    writeFileSync(join(root, '.radar', 'state.json'), 'not json');
    expect(loadState(root)).toEqual({});
    writeFileSync(join(root, '.radar', 'state.json'), JSON.stringify({ briefCursor: 'abc' }));
    expect(loadState(root)).toEqual({});
  });

  it('saveState merges and round-trips', () => {
    saveState(root, { briefCursor: 3 });
    const next = saveState(root, { lastBlock: { path: 'a.ts', message: 'm', ts: 1 } });
    expect(next).toEqual({ briefCursor: 3, lastBlock: { path: 'a.ts', message: 'm', ts: 1 } });
    expect(JSON.parse(readFileSync(join(root, '.radar', 'state.json'), 'utf8'))).toEqual(next);
  });
});

describe('createIgnoreMatcher', () => {
  it('uses defaults when .gitignore is missing and adds its rules when present', () => {
    expect(createIgnoreMatcher(root).ignores('tmp.log')).toBe(false);
    writeFileSync(join(root, '.gitignore'), '*.log\n');
    const m = createIgnoreMatcher(root);
    expect(m.ignores('tmp.log')).toBe(true);
    expect(m.ignores('node_modules/a')).toBe(true);
  });
});
