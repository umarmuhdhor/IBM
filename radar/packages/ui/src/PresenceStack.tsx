import { MemberChip } from './MemberChip';
import type { MemberOnlineStatus } from './MemberChip';
import type { MemberId } from './types';

export interface PresenceMember {
  id: MemberId;
  initials: string;
  status: MemberOnlineStatus;
}

export interface PresenceStackProps {
  members: PresenceMember[];
}

export function PresenceStack({ members }: PresenceStackProps) {
  return (
    <div role="group" aria-label="Team presence" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {members.map((member) => <MemberChip key={member.id} member={member.id} initials={member.initials} status={member.status} />)}
    </div>
  );
}
