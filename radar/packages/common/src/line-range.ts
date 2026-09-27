// Line-range locks (D-alief-17): ranges, a small line diff, a three-way merge and the lines a Bob edit touches.
// Line numbers are 1-based and inclusive. No dependencies: the Worker, the hooks and the app all import this.

export interface LineRange {
  start: number;
  end: number;
}

export function rangesOverlap(a: LineRange, b: LineRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Smallest range that covers every range, or null for none. */
export function spanOf(ranges: readonly LineRange[]): LineRange | null {
  if (ranges.length === 0) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const r of ranges) {
    start = Math.min(start, r.start);
    end = Math.max(end, r.end);
  }
  return { start, end };
}

/** Sorted, with overlapping and touching ranges joined. */
export function mergeRanges(ranges: readonly LineRange[]): LineRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: LineRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** "lines 3–5" or "line 10". */
export function rangeText(r: LineRange): string {
  return r.start === r.end ? `line ${r.start}` : `lines ${r.start}–${r.end}`;
}

/** "lines 3–5 · Alice"; a whole-file lock (no range) is just the name. */
export function lockLabel(name: string, range: LineRange | null | undefined): string {
  return range ? `${rangeText(range)} · ${name}` : name;
}

// ---- Line diff ---------------------------------------------------------------------------------------------

/** One change against `before`: lines [start, end) (0-based) become `lines`. start === end is an insertion. */
interface Hunk {
  start: number;
  end: number;
  lines: string[];
}

/** Above this many LCS cells the middle of the file counts as one changed block (safe: never too small). */
const MAX_LCS_CELLS = 4_000_000;

function splitLines(text: string): string[] {
  return text.split('\n');
}

function diffLines(a: readonly string[], b: readonly string[]): Hunk[] {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const n = a.length - pre - suf;
  const m = b.length - pre - suf;
  if (n === 0 && m === 0) return [];
  if (n === 0 || m === 0 || (n + 1) * (m + 1) > MAX_LCS_CELLS) {
    return [{ start: pre, end: pre + n, lines: b.slice(pre, pre + m) }];
  }
  // LCS table over the middle part: t[i][j] = LCS length of a[pre+i..] and b[pre+j..].
  const w = m + 1;
  const t = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i * w + j] = a[pre + i] === b[pre + j] ? t[(i + 1) * w + j + 1]! + 1 : Math.max(t[(i + 1) * w + j]!, t[i * w + j + 1]!);
    }
  }
  const hunks: Hunk[] = [];
  let cur: Hunk | null = null;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[pre + i] === b[pre + j]) {
      if (cur) hunks.push(cur);
      cur = null;
      i++;
      j++;
    } else if (j < m && (i === n || t[i * w + j + 1]! >= t[(i + 1) * w + j]!)) {
      cur ??= { start: pre + i, end: pre + i, lines: [] };
      cur.lines.push(b[pre + j]!);
      j++;
    } else {
      cur ??= { start: pre + i, end: pre + i, lines: [] };
      cur.end = pre + i + 1;
      i++;
    }
  }
  if (cur) hunks.push(cur);
  return hunks;
}

/** Lines of `before` that the change to `after` touches. An insertion before line n touches line n. */
export function changedLines(before: string, after: string): LineRange[] {
  const hunks = diffLines(splitLines(before), splitLines(after));
  return mergeRanges(hunks.map((h) => ({ start: h.start + 1, end: Math.max(h.end, h.start + 1) })));
}

export type MergeResult = { ok: true; merged: string } | { ok: false };

const sameHunk = (x: Hunk, y: Hunk) => x.start === y.start && x.end === y.end && x.lines.join('\n') === y.lines.join('\n');

/**
 * Three-way merge by lines. Hunks of both sides that overlap or touch (adjacent lines, or insertions at the same
 * place) are a conflict, unless they are the same change. Never picks one side silently.
 */
export function merge3(base: string, ours: string, theirs: string): MergeResult {
  const b = splitLines(base);
  const ho = diffLines(b, splitLines(ours));
  const ht = diffLines(b, splitLines(theirs));
  const all: Hunk[] = [...ho];
  for (const t of ht) {
    const clash = ho.find((o) => o.start <= t.end && t.start <= o.end);
    if (!clash) all.push(t);
    else if (!sameHunk(clash, t)) return { ok: false };
  }
  const out = [...b];
  for (const h of all.sort((x, y) => y.start - x.start)) out.splice(h.start, h.end - h.start, ...h.lines);
  return { ok: true, merged: out.join('\n') };
}

// ---- Lines a Bob edit touches (hooks) -----------------------------------------------------------------------

const SEARCH_BLOCK = /<<<<<<< SEARCH\r?\n(?::start_line:\s*(\d+)\s*\r?\n)?(?::end_line:\s*\d+\s*\r?\n)?(?:-------\r?\n)?([\s\S]*?)\r?\n=======/g;

/** 1-based line of character offset `idx`. */
function lineAt(text: string, idx: number): number {
  let n = 1;
  for (let k = text.indexOf('\n'); k !== -1 && k < idx; k = text.indexOf('\n', k + 1)) n++;
  return n;
}

function applyDiffLines(diff: string, content: string | null): LineRange[] | null {
  const out: LineRange[] = [];
  let found = false;
  for (const m of diff.matchAll(SEARCH_BLOCK)) {
    found = true;
    const search = m[2] ?? '';
    const count = splitLines(search).length;
    if (m[1]) {
      const start = Number(m[1]);
      out.push({ start, end: start + count - 1 });
      continue;
    }
    if (content === null || search === '') return null;
    const idx = content.indexOf(search);
    if (idx === -1) return null;
    const start = lineAt(content, idx);
    out.push({ start, end: start + count - 1 });
  }
  return found ? mergeRanges(out) : null;
}

function searchLines(input: Record<string, unknown>, content: string | null): LineRange[] | null {
  const search = input.search;
  if (typeof search !== 'string' || search === '' || content === null) return null;
  let re: RegExp;
  try {
    const flags = `g${input.ignore_case === true ? 'i' : ''}${input.use_regex === true ? 'm' : ''}`;
    re = new RegExp(input.use_regex === true ? search : search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch {
    return null;
  }
  const out: LineRange[] = [];
  for (const m of content.matchAll(re)) {
    if (m[0] === '') continue;
    const start = lineAt(content, m.index);
    out.push({ start, end: lineAt(content, m.index + m[0].length - 1) });
  }
  return mergeRanges(out);
}

/**
 * Lines of the file on disk (`content`, null if unreadable) a Bob tool call will change, or null when that is
 * unknown (whole-file edit). `input` is the tool input for one file.
 */
export function touchedLines(tool: string, input: Record<string, unknown>, content: string | null): LineRange[] | null {
  switch (tool) {
    case 'apply_diff':
      return typeof input.diff === 'string' ? applyDiffLines(input.diff, content) : null;
    case 'insert_content': {
      const line = Number(input.line);
      if (!Number.isInteger(line) || line < 0) return null;
      if (line > 0) return [{ start: line, end: line }];
      if (content === null) return null;
      const end = splitLines(content).length + (content.endsWith('\n') ? 0 : 1);
      return [{ start: end, end }];
    }
    case 'search_and_replace':
      return searchLines(input, content);
    default:
      return null;
  }
}
