export interface ReviewCardProps {
  title: string;
  added: number;
  removed: number;
  fileCount: number;
  impact?: string;
  verdict: string;
  pending?: boolean;
  /** Hide the review actions, e.g. for coders who cannot decide. */
  readOnly?: boolean;
  onApprove: () => void;
  onSendBack: () => void;
}

const buttonStyle = {
  padding: '3px 12px',
  borderRadius: '8px',
  fontSize: '12px',
  fontFamily: 'var(--lc-font-sans)',
  fontWeight: 500,
} as const;

export function ReviewCard({ title, added, removed, fileCount, impact, verdict, pending = false, readOnly = false, onApprove, onSendBack }: ReviewCardProps) {
  return (
    <article
      aria-label={`Review: ${title}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', border: '1px solid var(--lc-border)', borderLeft: '3px solid var(--lc-needs-you)', borderRadius: '10px', background: 'var(--lc-surface-2)', color: 'var(--lc-text)', fontFamily: 'var(--lc-font-sans)', fontSize: '13px', lineHeight: '20px' }}
    >
      <strong style={{ fontWeight: 500 }}>{title}</strong>
      <div style={{ color: 'var(--lc-text-muted)', fontFamily: 'var(--lc-font-mono)', fontSize: '12px' }}>{`+${added} −${removed} · ${fileCount} ${fileCount === 1 ? 'file' : 'files'}`}</div>
      {impact && <p style={{ margin: 0 }}>{impact}</p>}
      <p style={{ margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--lc-text-muted)' }}>{verdict}</p>
      {!readOnly && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <button type="button" disabled={pending} onClick={onApprove} style={{ ...buttonStyle, border: 'none', background: 'var(--lc-accent)', color: 'var(--lc-text)', opacity: pending ? 0.5 : 1 }}>Approve &amp; commit</button>
          <button type="button" disabled={pending} onClick={onSendBack} style={{ ...buttonStyle, border: '1px solid var(--lc-border)', background: 'transparent', color: 'var(--lc-text-muted)', opacity: pending ? 0.5 : 1 }}>Send back</button>
        </div>
      )}
    </article>
  );
}
