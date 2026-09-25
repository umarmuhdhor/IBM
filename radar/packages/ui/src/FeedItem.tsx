/**
 * FeedItem — a single entry in the Mission Control live feed.
 *
 * Shows:  timestamp · colored dot (actor color) · text · optional BobTrace.
 *
 * Feed kinds:
 *   edit     – Bob made an edit
 *   blocked  – Bob was blocked (red dot)
 *   decision – PM made a decision (magenta dot)
 *   commit   – commit merged
 *   info     – generic system message
 */
import { BobTrace } from './BobTrace';
import type { BobTracePrimitive } from './BobTrace';
import type { FeedKind, MemberId } from './types-temp';

export interface FeedItemTrace {
  primitive: BobTracePrimitive;
  detail: string;
  outcome?: string;
  ms?: number;
}

export interface FeedItemProps {
  /** Unix timestamp (ms). */
  ts: number;
  /** Actor member ID or "mc" (Mission Control) or "server". */
  actor: MemberId | 'mc' | 'server';
  /** Feed entry kind. */
  kind: FeedKind;
  /** Human-readable description text. */
  text: string;
  /** Optional Bob trace attached to this feed entry. */
  trace?: FeedItemTrace;
  /** Optional CSS class. */
  className?: string;
}

const MEMBER_COLOR_VAR: Record<string, string> = {
  A: 'var(--lc-member-a)',
  B: 'var(--lc-member-b)',
  C: 'var(--lc-member-c)',
  D: 'var(--lc-member-d)',
  mc: 'var(--lc-needs-you)',
  server: 'var(--lc-text-faint)',
};

const KIND_DOT_COLOR: Record<FeedKind, string> = {
  edit: 'inherit',
  blocked: 'var(--lc-danger)',
  decision: 'var(--lc-needs-you)',
  commit: 'var(--lc-ok)',
  info: 'var(--lc-text-faint)',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function FeedItem({ ts, actor, kind, text, trace, className }: FeedItemProps) {
  const actorColor = MEMBER_COLOR_VAR[actor] ?? 'var(--lc-text-faint)';
  const dotColor = KIND_DOT_COLOR[kind] === 'inherit' ? actorColor : KIND_DOT_COLOR[kind];

  return (
    <div
      className={['lc-feed-item', className].filter(Boolean).join(' ')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '4px 0',
        fontFamily: 'var(--lc-font-sans)',
        fontSize: '13px',
        lineHeight: '20px',
        color: 'var(--lc-text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        {/* Timestamp */}
        <span
          aria-label={`At ${formatTime(ts)}`}
          style={{
            fontFamily: 'var(--lc-font-mono)',
            fontSize: '11px',
            color: 'var(--lc-text-faint)',
            flexShrink: 0,
          }}
        >
          {formatTime(ts)}
        </span>

        {/* Colored dot */}
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
            alignSelf: 'center',
          }}
        />

        {/* Text */}
        <span>{text}</span>
      </div>

      {/* Optional BobTrace */}
      {trace && (
        <div style={{ paddingLeft: '50px' }}>
          <BobTrace
            primitive={trace.primitive}
            detail={trace.detail}
            outcome={trace.outcome}
            ms={trace.ms}
          />
        </div>
      )}
    </div>
  );
}
