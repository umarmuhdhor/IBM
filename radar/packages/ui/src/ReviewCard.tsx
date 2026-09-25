export interface ReviewCardProps {
  title: string;
  added: number;
  removed: number;
  fileCount: number;
  impact?: string;
  verdict: string;
  pending?: boolean;
  onApprove: () => void;
  onSendBack: () => void;
}

export function ReviewCard({ title, added, removed, fileCount, impact, verdict, pending = false, onApprove, onSendBack }: ReviewCardProps) {
  return (
    <article style={{ padding: 12, border: '1px solid var(--lc-border)', borderLeft: '3px solid var(--lc-needs-you)', borderRadius: 10, background: 'var(--lc-surface-2)', color: 'var(--lc-text)', fontFamily: 'var(--lc-font-sans)' }}>
      <strong>{title}</strong>
      <div style={{ color: 'var(--lc-text-muted)', fontFamily: 'var(--lc-font-mono)', fontSize: 12 }}>{`+${added} −${removed} · ${fileCount} ${fileCount === 1 ? 'file' : 'files'}`}</div>
      {impact && <p>{impact}</p>}
      <p>{verdict}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={pending} onClick={onApprove}>Approve &amp; commit</button>
        <button type="button" disabled={pending} onClick={onSendBack}>Send back</button>
      </div>
    </article>
  );
}
