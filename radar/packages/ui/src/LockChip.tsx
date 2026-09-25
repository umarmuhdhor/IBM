/**
 * LockChip — shows the lock state of a file in the explorer.
 *
 * States (R3 vocabulary):
 *   bebas    – free, no holder
 *   dipesan  – reserved (outline chip)
 *   dipegang – held (solid chip)
 *   review   – held for review (solid + clock icon)
 *
 * Accessible label is always the English word (Free / Reserved / Held / Review)
 * so screen-readers and tests can find it regardless of locale.
 */
import { Clock } from 'lucide-react';
import type { LockState } from './types-temp';

export interface LockChipProps {
  /** Lock state using R3 vocabulary. */
  state: LockState;
  /** Initials of the member currently holding or reserving the lock. */
  holder: string;
  /** Optional CSS class for the host. */
  className?: string;
}

const LABEL: Record<LockState, string> = {
  bebas: 'Free',
  dipesan: 'Reserved',
  dipegang: 'Held',
  review: 'Review',
};

export function LockChip({ state, holder, className }: LockChipProps) {
  const label = LABEL[state];
  const isFree = state === 'bebas';
  const isOutline = state === 'dipesan';
  const isReview = state === 'review';

  return (
    <span
      aria-label={label}
      data-state={state}
      className={['lc-lock-chip', `lc-lock-chip--${state}`, className]
        .filter(Boolean)
        .join(' ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: isFree ? '0 4px' : '1px 5px',
        borderRadius: '6px',
        fontSize: '11px',
        fontFamily: 'var(--lc-font-mono)',
        lineHeight: '18px',
        color: isFree
          ? 'var(--lc-text-faint)'
          : 'var(--lc-text)',
        background: isFree
          ? 'transparent'
          : isOutline
          ? 'transparent'
          : 'var(--lc-surface-3)',
        border: isFree
          ? '1px solid var(--lc-border)'
          : isOutline
          ? '1px solid currentColor'
          : '1px solid transparent',
        opacity: isFree ? 0.5 : 1,
      }}
    >
      {!isFree && <span>{holder}</span>}
      {isReview && (
        <Clock
          size={10}
          strokeWidth={1.5}
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        />
      )}
      {isFree && <span aria-hidden="true">·</span>}
    </span>
  );
}
