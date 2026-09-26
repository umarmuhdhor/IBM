/**
 * MemberChip — 20 px circular avatar showing a member's initials and online dot.
 *
 * Online states:
 *   online  – green dot
 *   stale   – yellow dot (connected but hasn't pushed in > 2 min)
 *   offline – grey (no dot)
 */
import type { MemberId } from './types';

export type MemberOnlineStatus = 'online' | 'stale' | 'offline';

export interface MemberChipProps {
  /** Member identifier (A / B / C / D). Used for color. */
  member: MemberId;
  /** Single character label shown in the circle (usually the member initial). */
  initials: string;
  /** Online / presence status. Defaults to "offline". */
  status?: MemberOnlineStatus;
  /** Optional CSS class. */
  className?: string;
}

const MEMBER_COLOR_VAR: Record<string, string> = {
  A: 'var(--lc-member-a)',
  B: 'var(--lc-member-b)',
  C: 'var(--lc-member-c)',
  D: 'var(--lc-member-d)',
};

const DOT_COLOR: Record<MemberOnlineStatus, string | null> = {
  online: 'var(--lc-ok)',
  stale: 'var(--lc-warn)',
  offline: null,
};

export function MemberChip({ member, initials, status = 'offline', className }: MemberChipProps) {
  const color = MEMBER_COLOR_VAR[member] ?? 'var(--lc-text-muted)';
  const dotColor = DOT_COLOR[status];

  return (
    <span
      aria-label={`Member ${initials}, ${status}`}
      data-member={member}
      data-status={status}
      className={['lc-member-chip', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
    >
      {/* Circle avatar */}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
          border: `1.5px solid ${color}`,
          color,
          fontFamily: 'var(--lc-font-mono)',
          fontSize: '10px',
          fontWeight: 500,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {initials}
      </span>

      {/* Online dot */}
      {dotColor && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '-1px',
            right: '-1px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: dotColor,
            border: '1.5px solid var(--lc-surface-2)',
          }}
        />
      )}
    </span>
  );
}
