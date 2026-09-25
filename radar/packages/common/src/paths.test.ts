import { describe, expect, it } from 'vitest';
import {
  basename,
  isInside,
  normalizeRelative,
  PathOutsideWorkspaceError,
  toPosix,
  toWorkspaceRelative,
  tryWorkspaceRelative,
} from './paths.js';

describe('paths', () => {
  it('toPosix replaces backslashes', () => {
    expect(toPosix('src\\ui\\Header.tsx')).toBe('src/ui/Header.tsx');
  });

  it('normalizeRelative strips ./ and folds ..', () => {
    expect(normalizeRelative('./src/./ui/../checkout/checkout.ts')).toBe('src/checkout/checkout.ts');
    expect(normalizeRelative('src//utils.ts')).toBe('src/utils.ts');
  });

  it('normalizeRelative rejects absolute paths and escapes', () => {
    expect(() => normalizeRelative('/etc/passwd')).toThrow(PathOutsideWorkspaceError);
    expect(() => normalizeRelative('C:\\x.ts')).toThrow(PathOutsideWorkspaceError);
    expect(() => normalizeRelative('../outside.ts')).toThrow(PathOutsideWorkspaceError);
    expect(() => normalizeRelative('src/../../x')).toThrow(PathOutsideWorkspaceError);
  });

  it('toWorkspaceRelative accepts absolute paths inside the root', () => {
    expect(toWorkspaceRelative('/Users/demo/toko-demo', '/Users/demo/toko-demo/src/utils.ts')).toBe('src/utils.ts');
    expect(toWorkspaceRelative('/Users/demo/toko-demo/', '/Users/demo/toko-demo/./src/../src/a.ts')).toBe('src/a.ts');
    expect(toWorkspaceRelative('/Users/demo/toko-demo', 'src/a.ts')).toBe('src/a.ts');
  });

  it('toWorkspaceRelative throws for paths outside the root, including sibling prefixes', () => {
    expect(() => toWorkspaceRelative('/Users/demo/toko-demo', '/Users/demo/other/a.ts')).toThrow(PathOutsideWorkspaceError);
    expect(() => toWorkspaceRelative('/Users/demo/toko-demo', '/Users/demo/toko-demo-2/a.ts')).toThrow(PathOutsideWorkspaceError);
    expect(() => toWorkspaceRelative('/Users/demo/toko-demo', '/Users/demo/toko-demo/../x.ts')).toThrow(PathOutsideWorkspaceError);
  });

  it('handles Windows drives case-insensitively', () => {
    expect(toWorkspaceRelative('C:\\Users\\Demo\\toko-demo', 'c:\\users\\demo\\TOKO-DEMO\\src\\App.tsx')).toBe('src/App.tsx');
    expect(() => toWorkspaceRelative('C:\\toko', 'D:\\toko\\a.ts')).toThrow(PathOutsideWorkspaceError);
  });

  it('POSIX roots are case-sensitive unless asked otherwise', () => {
    expect(() => toWorkspaceRelative('/Users/demo/toko', '/users/demo/toko/a.ts')).toThrow(PathOutsideWorkspaceError);
    expect(toWorkspaceRelative('/Users/demo/toko', '/users/demo/toko/a.ts', { caseInsensitive: true })).toBe('a.ts');
  });

  it('tryWorkspaceRelative and isInside do not throw', () => {
    expect(tryWorkspaceRelative('/w', '/elsewhere/a.ts')).toBeNull();
    expect(tryWorkspaceRelative('/w', '/w')).toBeNull();
    expect(tryWorkspaceRelative('/w', '/w/a.ts')).toBe('a.ts');
    expect(isInside('/w', '/w/a/b.ts')).toBe(true);
    expect(isInside('/w', '/x/b.ts')).toBe(false);
  });

  it('basename returns the last segment', () => {
    expect(basename('src/checkout/checkout.ts')).toBe('checkout.ts');
    expect(basename('README.md')).toBe('README.md');
  });
});
