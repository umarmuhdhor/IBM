/**
 * WritingPulse — small animated pencil indicator shown for 3 s after a file.changed event.
 *
 * Animates with opacity 1 → 0.3 at 900 ms. Respects prefers-reduced-motion.
 * The pulse color matches the member who made the change.
 */
import type { MemberId } from './types';

export interface WritingPulseProps {
  /** Member whose Bob is writing — drives the dot color. */
  member: MemberId;
  /** Optional CSS class. */
  className?: string;
}

const MEMBER_COLOR_VAR: Record<string, string> = {
  A: 'var(--lc-member-a)',
  B: 'var(--lc-member-b)',
  C: 'var(--lc-member-c)',
  D: 'var(--lc-member-d)',
};

export function WritingPulse({ member, className }: WritingPulseProps) {
  const color = MEMBER_COLOR_VAR[member] ?? 'var(--lc-text-muted)';

  return (
    <span
      aria-label="Writing"
      role="status"
      className={['lc-writing-pulse', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontFamily: 'var(--lc-font-mono)',
        fontSize: '11px',
        color,
      }}
    >
      {/* Pencil glyph */}
      <span aria-hidden="true" style={{ fontSize: '10px' }}>✎</span>

      {/* Three pulsing dots */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: color,
            animation: 'lc-pulse 900ms ease-in-out infinite alternate',
            animationDelay: `${i * 180}ms`,
          }}
        />
      ))}

      {/* Keyframe definition — injected once per instance but harmless if duplicated */}
      <style>{`
        @keyframes lc-pulse {
          from { opacity: 1; }
          to   { opacity: 0.3; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lc-writing-pulse [aria-hidden] { animation: none; }
        }
      `}</style>
    </span>
  );
}
