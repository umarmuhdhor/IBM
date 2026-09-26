export type AgentTagProps = {
  label: string;
  member: string;
  status?: 'idle' | 'writing' | 'blocked';
};

const MEMBER_COLOR: Record<string, string> = {
  A: 'var(--lc-member-a)',
  B: 'var(--lc-member-b)',
  C: 'var(--lc-member-c)',
  D: 'var(--lc-member-d)',
};

export function AgentTag({ label, member, status = 'idle' }: AgentTagProps) {
  const color = MEMBER_COLOR[member] ?? 'var(--lc-text-muted)';
  return (
    <span
      className="lc-agent-tag"
      data-member={member}
      data-status={status}
      aria-label={`Agent ${label}, member ${member}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        borderRadius: 6,
        border: `1px solid ${status === 'blocked' ? 'var(--lc-danger)' : color}`,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        fontFamily: 'var(--lc-font-mono)',
        fontSize: 11,
      }}
    >
      {status === 'writing' && <span aria-hidden="true">●</span>}
      {label}
    </span>
  );
}
