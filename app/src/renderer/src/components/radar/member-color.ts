// Owner colors from the --lc-member-* tokens (main.css); unknown members fall back to muted text.
const MEMBER_COLOR: Record<string, string> = {
  A: 'var(--lc-member-a)',
  B: 'var(--lc-member-b)',
  C: 'var(--lc-member-c)',
  D: 'var(--lc-member-d)'
}

export function memberColorVar(memberId: string): string {
  return MEMBER_COLOR[memberId] ?? 'var(--lc-text-muted)'
}
