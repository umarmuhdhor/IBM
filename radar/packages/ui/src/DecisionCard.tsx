/**
 * DecisionCard — PM decision prompt for a pending proposal.
 *
 * Renders a card with a magenta left border for "Needs you" items.
 * The Approve / Deny buttons delegate to the onApprove / onDeny callbacks;
 * no fetch happens inside this component (pure presentational).
 */

export type DecisionStatus = 'pending' | 'deciding' | 'approved' | 'denied' | 'auto-applied';

export interface DecisionCardProps {
  /** Short title, e.g. "Budi needs checkout.ts". */
  title: string;
  /** One-sentence reason from the main agent. */
  reason: string;
  /** Current status of the decision card. Defaults to "pending". */
  status?: DecisionStatus;
  /** Called when the PM clicks Approve. */
  onApprove: () => void;
  /** Called when the PM clicks Deny. */
  onDeny: () => void;
  /** Optional extra CSS class. */
  className?: string;
}

export function DecisionCard({
  title,
  reason,
  status = 'pending',
  onApprove,
  onDeny,
  className,
}: DecisionCardProps) {
  const isPending = status === 'pending';
  const isDeciding = status === 'deciding';
  const isApproved = status === 'approved';
  const isDenied = status === 'denied';
  const isAutoApplied = status === 'auto-applied';
  const isResolved = isApproved || isDenied || isAutoApplied;

  return (
    <div
      role="article"
      aria-label={`Decision: ${title}`}
      className={['lc-decision-card', className].filter(Boolean).join(' ')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'var(--lc-surface-2)',
        border: '1px solid var(--lc-border)',
        borderLeft: '3px solid var(--lc-needs-you)',
        fontFamily: 'var(--lc-font-sans)',
        fontSize: '13px',
        lineHeight: '20px',
        color: 'var(--lc-text)',
        opacity: isResolved ? 0.65 : 1,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontWeight: 500,
          fontSize: '13px',
          color: 'var(--lc-text)',
        }}
      >
        {title}
      </div>

      {/* Reason */}
      <div
        style={{
          fontSize: '12px',
          color: 'var(--lc-text-muted)',
          lineHeight: '18px',
        }}
      >
        {reason}
      </div>

      {/* Status badge when resolved */}
      {isResolved && (
        <div
          style={{
            fontSize: '11px',
            color: isApproved || isAutoApplied ? 'var(--lc-ok)' : 'var(--lc-danger)',
            fontFamily: 'var(--lc-font-mono)',
          }}
        >
          {isApproved && '✓ approved'}
          {isDenied && '✗ denied'}
          {isAutoApplied && '✓ auto-applied'}
        </div>
      )}

      {/* Action buttons (only when pending or deciding) */}
      {!isResolved && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <button
            type="button"
            aria-label="Approve"
            disabled={isDeciding}
            onClick={onApprove}
            style={{
              padding: '3px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'var(--lc-font-sans)',
              fontWeight: 500,
              cursor: isDeciding ? 'default' : 'pointer',
              background: 'var(--lc-accent)',
              color: '#ffffff',
              border: 'none',
              opacity: isDeciding ? 0.5 : 1,
            }}
          >
            {isDeciding ? '…' : 'Approve'}
          </button>
          <button
            type="button"
            aria-label="Deny"
            disabled={isDeciding}
            onClick={onDeny}
            style={{
              padding: '3px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'var(--lc-font-sans)',
              fontWeight: 500,
              cursor: isDeciding ? 'default' : 'pointer',
              background: 'transparent',
              color: 'var(--lc-text-muted)',
              border: '1px solid var(--lc-border)',
              opacity: isDeciding ? 0.5 : 1,
            }}
          >
            Deny
          </button>
        </div>
      )}
    </div>
  );
}
