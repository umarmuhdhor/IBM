import { describe, expect, it } from 'vitest';
import {
  changedLines,
  lockLabel,
  merge3,
  mergeRanges,
  rangeText,
  rangesOverlap,
  spanOf,
  touchedLines,
  type LineRange,
} from './line-range.js';

const r = (start: number, end: number): LineRange => ({ start, end });
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n') + '\n';

describe('rangesOverlap (D-alief-17 overlap rule)', () => {
  it.each([
    [r(3, 5), r(3, 3), true],
    [r(3, 5), r(5, 9), true],
    [r(3, 5), r(1, 3), true],
    [r(3, 5), r(4, 4), true],
    [r(3, 5), r(1, 10), true],
    [r(3, 5), r(6, 6), false],
    [r(3, 5), r(10, 10), false],
    [r(3, 5), r(1, 2), false],
    [r(1, 1), r(1, 1), true],
  ])('%o vs %o = %s', (a, b, want) => {
    expect(rangesOverlap(a, b)).toBe(want);
    expect(rangesOverlap(b, a)).toBe(want);
  });
});

describe('spanOf / mergeRanges', () => {
  it('spans every range', () => {
    expect(spanOf([r(10, 10), r(3, 5)])).toEqual(r(3, 10));
    expect(spanOf([])).toBeNull();
  });
  it('merges overlapping and touching ranges, sorted', () => {
    expect(mergeRanges([r(8, 9), r(3, 5), r(5, 6), r(10, 10)])).toEqual([r(3, 6), r(8, 10)]);
  });
});

describe('labels', () => {
  it('names lines and holder', () => {
    expect(rangeText(r(3, 5))).toBe('lines 3–5');
    expect(rangeText(r(10, 10))).toBe('line 10');
    expect(lockLabel('Alice', r(3, 5))).toBe('lines 3–5 · Alice');
    expect(lockLabel('Budi', r(10, 10))).toBe('line 10 · Budi');
    expect(lockLabel('Alice', null)).toBe('Alice');
    expect(lockLabel('Alice', undefined)).toBe('Alice');
  });
});

describe('changedLines (lines of `before` an edit touches)', () => {
  const base = lines(12);
  it('a replaced line', () => {
    expect(changedLines(base, base.replace('line 10\n', 'line ten\n'))).toEqual([r(10, 10)]);
  });
  it('a replaced block', () => {
    const after = base.replace('line 3\nline 4\nline 5\n', 'A\nB\n');
    expect(changedLines(base, after)).toEqual([r(3, 5)]);
  });
  it('an insertion before line n touches line n', () => {
    expect(changedLines(base, base.replace('line 6\n', 'new\nline 6\n'))).toEqual([r(6, 6)]);
  });
  it('a deletion', () => {
    expect(changedLines(base, base.replace('line 7\n', ''))).toEqual([r(7, 7)]);
  });
  it('two separate edits', () => {
    const after = base.replace('line 2\n', 'two\n').replace('line 11\n', 'eleven\n');
    expect(changedLines(base, after)).toEqual([r(2, 2), r(11, 11)]);
  });
  it('no change', () => {
    expect(changedLines(base, base)).toEqual([]);
  });
  it('append at end of file', () => {
    expect(changedLines(base, base + 'line 13\n')).toEqual([r(13, 13)]);
  });
});

describe('merge3 (server second layer)', () => {
  const base = lines(12);
  const alice = base.replace('line 3\nline 4\nline 5\n', 'alice 3\nalice 4\nalice 5\n');
  const budi10 = base.replace('line 10\n', 'budi 10\n');
  const budi4 = base.replace('line 4\n', 'budi 4\n');

  it('keeps both edits when they do not overlap', () => {
    const m = merge3(base, alice, budi10);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.merged).toContain('alice 4');
    expect(m.merged).toContain('budi 10');
    expect(m.merged.split('\n')).toHaveLength(base.split('\n').length);
  });
  it('is symmetric for non-overlapping edits', () => {
    const a = merge3(base, alice, budi10);
    const b = merge3(base, budi10, alice);
    expect(a).toEqual(b);
  });
  it('reports a conflict when edits overlap', () => {
    expect(merge3(base, alice, budi4)).toEqual({ ok: false });
  });
  it('reports a conflict when edits touch adjacent lines', () => {
    const budi6 = base.replace('line 6\n', 'budi 6\n');
    expect(merge3(base, alice, budi6)).toEqual({ ok: false });
  });
  it('accepts the same edit on both sides', () => {
    expect(merge3(base, alice, alice)).toEqual({ ok: true, merged: alice });
  });
  it('handles an insertion that shifts lines', () => {
    const ins = base.replace('line 1\n', 'line 1\nnew\nnew\n');
    const m = merge3(base, ins, budi10);
    expect(m.ok && m.merged.includes('new\nnew\n') && m.merged.includes('budi 10')).toBe(true);
  });
  it('one side unchanged returns the other', () => {
    expect(merge3(base, base, budi10)).toEqual({ ok: true, merged: budi10 });
    expect(merge3(base, alice, base)).toEqual({ ok: true, merged: alice });
  });
});

describe('touchedLines (hook range extraction)', () => {
  const file = lines(12);

  it('apply_diff with :start_line: uses the SEARCH line count', () => {
    const diff = '<<<<<<< SEARCH\n:start_line:3\n-------\nline 3\nline 4\nline 5\n=======\nX\n>>>>>>> REPLACE';
    expect(touchedLines('apply_diff', { diff }, file)).toEqual([r(3, 5)]);
  });
  it('apply_diff without start_line finds the SEARCH text in the file', () => {
    const diff = '<<<<<<< SEARCH\nline 10\n=======\nX\n>>>>>>> REPLACE';
    expect(touchedLines('apply_diff', { diff }, file)).toEqual([r(10, 10)]);
  });
  it('apply_diff with several blocks', () => {
    const diff =
      '<<<<<<< SEARCH\n:start_line:2\n-------\nline 2\n=======\nX\n>>>>>>> REPLACE\n\n' +
      '<<<<<<< SEARCH\n:start_line:9\n-------\nline 9\nline 10\n=======\nY\n>>>>>>> REPLACE';
    expect(touchedLines('apply_diff', { diff }, file)).toEqual([r(2, 2), r(9, 10)]);
  });
  it('apply_diff with SEARCH text not in the file is unknown', () => {
    const diff = '<<<<<<< SEARCH\nnot here\n=======\nX\n>>>>>>> REPLACE';
    expect(touchedLines('apply_diff', { diff }, file)).toBeNull();
  });
  it('the spike fixture shape', () => {
    const diff = '<<<<<<< SEARCH\n:start_line:1\n-------\n// a\n=======\n// hi\n// a\n>>>>>>> REPLACE';
    expect(touchedLines('apply_diff', { diff }, '// a\n')).toEqual([r(1, 1)]);
  });
  it('insert_content at a line, and at 0 = end of file', () => {
    expect(touchedLines('insert_content', { line: 4, content: 'x\n' }, file)).toEqual([r(4, 4)]);
    expect(touchedLines('insert_content', { line: 0, content: 'x\n' }, file)).toEqual([r(13, 13)]);
  });
  it('search_and_replace = every line with a match', () => {
    expect(touchedLines('search_and_replace', { search: 'line 1' }, file)).toEqual([r(1, 1), r(10, 12)]);
    expect(touchedLines('search_and_replace', { search: 'line 4\nline 5' }, file)).toEqual([r(4, 5)]);
    expect(touchedLines('search_and_replace', { search: 'nothing' }, file)).toEqual([]);
  });
  it('search_and_replace with use_regex', () => {
    expect(touchedLines('search_and_replace', { search: '^line [23]$', use_regex: true }, file)).toEqual([r(2, 3)]);
  });
  it('write_to_file and unknown tools are whole-file (null)', () => {
    expect(touchedLines('write_to_file', { content: 'x' }, file)).toBeNull();
    expect(touchedLines('write_file', { content: 'x' }, file)).toBeNull();
    expect(touchedLines('apply_diff', { diff: 'garbage' }, file)).toBeNull();
  });
  it('without the file on disk, only start_line diffs are known', () => {
    const diff = '<<<<<<< SEARCH\n:start_line:3\n-------\nline 3\n=======\nX\n>>>>>>> REPLACE';
    expect(touchedLines('apply_diff', { diff }, null)).toEqual([r(3, 3)]);
    expect(touchedLines('insert_content', { line: 2 }, null)).toEqual([r(2, 2)]);
    expect(touchedLines('search_and_replace', { search: 'a' }, null)).toBeNull();
  });
});
