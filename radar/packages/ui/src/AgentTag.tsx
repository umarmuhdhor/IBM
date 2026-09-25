// Placeholder agent label (fase 00). The real component set (R1 §2.1) is built in fase 09.
export type AgentTagProps = {
  label: string;
  member: string;
};

export function AgentTag({ label, member }: AgentTagProps) {
  return (
    <span
      className="lc-agent-tag"
      data-member={member}
      aria-label={`Agent ${label}, member ${member}`}
    >
      {label}
    </span>
  );
}
