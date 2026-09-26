// Smoke tests for the primitive-mapping helpers defined in app/demo/page.tsx.
// We cannot import the page directly (it's a Next.js client component with hooks),
// so we duplicate the two pure mapping functions here and test them in isolation.
// If the page changes its mapping logic, update these tests too.
import { describe, expect, it } from 'vitest';
import type { BobActivityItem } from '@radar/common';
import type { BobTracePrimitive } from '@radar/ui';
import type { Decision } from '@radar/common';

// ── Duplicated helpers (keep in sync with app/demo/page.tsx) ─────────────────

function toBobPrimitive(item: BobActivityItem): BobTracePrimitive {
  if (item.kind === 'tool.pre' || item.kind === 'tool.post') return 'hook';
  if (item.kind === 'session.start' || item.kind === 'turn.end') return 'mode';
  if (item.tool) return 'hook';
  return 'mode';
}

function toBobDetail(item: BobActivityItem): string {
  const toolOrKind = item.tool ?? item.kind;
  const paths = item.paths?.join(', ') ?? '';
  return paths ? `${toolOrKind} · ${paths}` : toolOrKind;
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeItem(overrides: Partial<BobActivityItem>): BobActivityItem {
  return {
    id: 1,
    ts: 0,
    memberId: 'A',
    kind: 'session.start',
    sessionId: null,
    mode: 'coder',
    ...overrides,
  };
}

// ── toBobPrimitive tests ──────────────────────────────────────────────────────

describe('toBobPrimitive', () => {
  it('maps tool.pre → hook', () => {
    expect(toBobPrimitive(makeItem({ kind: 'tool.pre' }))).toBe('hook');
  });

  it('maps tool.post → hook', () => {
    expect(toBobPrimitive(makeItem({ kind: 'tool.post' }))).toBe('hook');
  });

  it('maps session.start → mode', () => {
    expect(toBobPrimitive(makeItem({ kind: 'session.start' }))).toBe('mode');
  });

  it('maps turn.end → mode', () => {
    expect(toBobPrimitive(makeItem({ kind: 'turn.end' }))).toBe('mode');
  });

  it('maps prompt with tool present → hook (tool takes priority)', () => {
    expect(toBobPrimitive(makeItem({ kind: 'prompt', tool: 'some_tool' }))).toBe('hook');
  });

  it('maps prompt without tool → mode (fallback)', () => {
    expect(toBobPrimitive(makeItem({ kind: 'prompt' }))).toBe('mode');
  });
});

// ── toBobDetail tests ─────────────────────────────────────────────────────────

describe('toBobDetail', () => {
  it('uses tool name when present with no paths', () => {
    expect(toBobDetail(makeItem({ kind: 'tool.pre', tool: 'lock_guard' }))).toBe('lock_guard');
  });

  it('uses tool name with paths when both present', () => {
    expect(
      toBobDetail(makeItem({ kind: 'tool.post', tool: 'write', paths: ['a.ts', 'b.ts'] })),
    ).toBe('write · a.ts, b.ts');
  });

  it('falls back to kind when no tool', () => {
    expect(toBobDetail(makeItem({ kind: 'session.start' }))).toBe('session.start');
  });

  it('uses kind with paths when no tool but paths present', () => {
    expect(toBobDetail(makeItem({ kind: 'tool.post', paths: ['x.ts'] }))).toBe(
      'tool.post · x.ts',
    );
  });

  it('returns empty paths joined with comma', () => {
    expect(
      toBobDetail(makeItem({ kind: 'tool.pre', tool: 'read', paths: ['a.ts', 'b.ts', 'c.ts'] })),
    ).toBe('read · a.ts, b.ts, c.ts');
  });
});

// ── Quote routing logic ───────────────────────────────────────────────────────

// Replicate the quote picker inline to keep the test file self-contained.
interface BobQuotes {
  brief_seen: string[];
  bob_after_block: string[];
  hook_block_message: string;
  why_blocked_output: string[];
  bob_refuses_shortcut: string;
  pm: Record<string, string>;
}

function pickQuote(item: BobActivityItem, quotes: BobQuotes): string | null {
  if (item.memberId === 'B' && item.kind === 'tool.pre' && item.decision === 'block') {
    return quotes.bob_after_block[0] ?? null;
  }
  if (item.decision === 'block') {
    return quotes.hook_block_message ?? null;
  }
  if (item.kind === 'session.start') {
    return quotes.brief_seen[0] ?? null;
  }
  return quotes.brief_seen[0] ?? null;
}

const FIXTURE_QUOTES: BobQuotes = {
  brief_seen: ['brief line 1'],
  bob_after_block: ['bob after block line 1'],
  hook_block_message: 'hook block message',
  why_blocked_output: [],
  bob_refuses_shortcut: '',
  pm: {},
};

describe('pickQuote', () => {
  it('returns bob_after_block for member B + tool.pre + block decision', () => {
    const item = makeItem({ memberId: 'B', kind: 'tool.pre', decision: 'block' as Decision });
    expect(pickQuote(item, FIXTURE_QUOTES)).toBe('bob after block line 1');
  });

  it('returns hook_block_message for any other member + block decision', () => {
    const item = makeItem({ memberId: 'A', kind: 'tool.pre', decision: 'block' as Decision });
    expect(pickQuote(item, FIXTURE_QUOTES)).toBe('hook block message');
  });

  it('returns brief_seen[0] for session.start', () => {
    const item = makeItem({ kind: 'session.start' });
    expect(pickQuote(item, FIXTURE_QUOTES)).toBe('brief line 1');
  });

  it('returns brief_seen[0] as fallback for other kinds', () => {
    const item = makeItem({ kind: 'turn.end' });
    expect(pickQuote(item, FIXTURE_QUOTES)).toBe('brief line 1');
  });

  it('returns null when bob_after_block is empty and matches B+block', () => {
    const sparse: BobQuotes = { ...FIXTURE_QUOTES, bob_after_block: [] };
    const item = makeItem({ memberId: 'B', kind: 'tool.pre', decision: 'block' as Decision });
    expect(pickQuote(item, sparse)).toBeNull();
  });
});
