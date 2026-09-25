/**
 * BobTrace — single dim mono line summarising a Bob primitive event.
 *
 * Format:  <icon> <primitive> · <detail> → <outcome> · <ms> ms
 * Examples:
 *   ⚓ hook · PreToolUse · lock_guard → blocked · 84 ms
 *   ⧉ mcp · radar.why_blocked
 *   ◐ mode · coder
 *
 * Primitive icons:
 *   hook  → ⚓
 *   mcp   → ⧉
 *   mode  → ◐
 */

export type BobTracePrimitive = 'hook' | 'mcp' | 'mode';

export interface BobTraceProps {
  /** The Bob primitive type. */
  primitive: BobTracePrimitive;
  /** Detail string, e.g. "PreToolUse · lock_guard". */
  detail: string;
  /** Optional outcome, e.g. "blocked" or "allowed". */
  outcome?: string;
  /** Optional duration in ms. */
  ms?: number;
  /** Optional CSS class. */
  className?: string;
}
const PRIMITIVE_ICON: Record<BobTracePrimitive, string> = {
  hook: '⚓',
  mcp: '⧉',
  mode: '◐',
};

const OUTCOME_COLOR: Record<string, string> = {
  blocked: 'var(--lc-danger)',
  allowed: 'var(--lc-ok)',
  injecting: 'var(--lc-warn)',
};

export function BobTrace({ primitive, detail, outcome, ms, className }: BobTraceProps) {
  const icon = PRIMITIVE_ICON[primitive];
  const outcomeColor = outcome ? (OUTCOME_COLOR[outcome] ?? 'var(--lc-text-faint)') : undefined;

  const parts: React.ReactNode[] = [
    <span key="icon" aria-hidden="true" style={{ opacity: 0.7 }}>
      {icon}
    </span>,
    <span key="primitive">{primitive}</span>,
    ' · ',
    <span key="detail">{detail}</span>,
  ];

  if (outcome) {
    parts.push(
      ' → ',
      <span key="outcome" style={{ color: outcomeColor }}>
        {outcome}
      </span>,
    );
  }

  if (ms !== undefined) {
    parts.push(
      ' · ',
      <span key="ms" style={{ color: 'var(--lc-text-faint)' }}>
        {ms} ms
      </span>,
    );
  }

  return (
    <code
      aria-label={`Bob trace: ${primitive} ${detail}${outcome ? ` → ${outcome}` : ''}${ms !== undefined ? ` · ${ms} ms` : ''}`}
      className={['lc-bob-trace', className].filter(Boolean).join(' ')}
      style={{
        display: 'block',
        fontFamily: 'var(--lc-font-mono)',
        fontSize: '12px',
        lineHeight: '18px',
        color: 'var(--lc-text-faint)',
        whiteSpace: 'pre',
        gap: '2px',
      }}
    >
      {parts}
    </code>
  );
}
