// Core presentational components — pure props, no fetch
export { AgentTag } from './AgentTag';
export type { AgentTagProps } from './AgentTag';

export { MemberChip } from './MemberChip';
export type { MemberChipProps, MemberOnlineStatus } from './MemberChip';

export { LockChip } from './LockChip';
export type { LockChipProps } from './LockChip';

export { WritingPulse } from './WritingPulse';
export type { WritingPulseProps } from './WritingPulse';

export { BobTrace } from './BobTrace';
export type { BobTraceProps, BobTracePrimitive } from './BobTrace';

export { DecisionCard } from './DecisionCard';
export type { DecisionCardProps, DecisionStatus } from './DecisionCard';

export { TaskCard } from './TaskCard';
export type { TaskCardProps } from './TaskCard';

export { FeedItem } from './FeedItem';
export type { FeedItemProps, FeedItemTrace } from './FeedItem';

export { ReviewCard } from './ReviewCard';
export type { ReviewCardProps } from './ReviewCard';

export { BriefMeter } from './BriefMeter';
export type { BriefMeterProps } from './BriefMeter';

export { PresenceStack } from './PresenceStack';
export type { PresenceStackProps, PresenceMember } from './PresenceStack';

// Shared view types from the frozen Radar contract.
export type {
  RadarEvent,
  RadarState,
  TaskStatus,
  LockState,
  MemberId,
  Role,
  MemberView,
  TaskView,
  LockView,
  FileView,
  RequestView,
  ProposalView,
  ProposalStatus,
  ProposalKind,
  FeedKind,
  BobActivityKind,
  BobActivityItem,
} from './types';

// Re-export FeedItem type from types under a distinct name to avoid collision
// with the FeedItem component above.
export type { FeedItem as FeedItemData } from './types';
