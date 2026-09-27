// Event catalog (R3 §5) and the plain-English feed sentences shown in Mission Control.
import { basename } from './paths.js';
import type { RadarEvent, RadarEventType } from './schemas.js';

export const EVENT_TYPES = [
  'workspace.created',
  'member.created',
  'member.online',
  'member.offline',
  'member.reconnected',
  'member.stale',
  'file.changed',
  'file.deleted',
  'file.rejected',
  'sync.applied',
  'lock.reserved',
  'lock.acquired',
  'lock.review',
  'lock.released',
  'lock.transferred',
  'lock.queued',
  'lock.revoked',
  'lock.blocked',
  'hook.failopen',
  'task.created',
  'task.status',
  'task.submitted',
  'request.created',
  'request.decided',
  'proposal.created',
  'proposal.decided',
  'review.created',
  'review.flagged',
  'notify.sent',
  'commit.created',
  'commit.push_failed',
  'bob.activity',
  'ai.edit',
  'bob.turn',
  'bob.said',
] as const satisfies readonly RadarEventType[];

const WITA_OFFSET_MS = 8 * 60 * 60 * 1000; // Asia/Makassar, UTC+8, no DST.

/** 'HH:mm' in Asia/Makassar. Fixed offset instead of Intl so Node and Workers agree. */
export function formatClock(ts: number): string {
  const d = new Date(ts + WITA_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const TASK_STATUS_TEXT: Record<string, string> = {
  draf: 'draft',
  terbuka: 'open',
  dikerjakan: 'in progress',
  review: 'in review',
  selesai: 'done',
  batal: 'cancelled',
};
const PROPOSAL_STATUS_TEXT: Record<string, string> = {
  menunggu: 'is waiting for the PM',
  disetujui: 'is approved',
  ditolak: 'is rejected',
  diterapkan_otomatis: 'is applied automatically',
  kedaluwarsa: 'expired',
};
const OUTCOME_TEXT: Record<string, string> = {
  antre: 'queued',
  pindahkan: 'file moved',
  pecah: 'task split',
  ditolak: 'rejected',
};
const VERDICT_TEXT: Record<string, string> = {
  setujui: 'approve',
  setujui_beri_tahu: 'approve and tell the team',
  kembalikan: 'send back',
};

/** Member id → display name; ids without a name are shown as-is. */
export type FeedNames = Readonly<Record<string, string>>;

// Plain-English feed sentences (same voice as the /demo replay narrator), with member names.
function sentence(ev: RadarEvent, names: FeedNames): string | null {
  const who = (id: string) => names[id] ?? id;
  switch (ev.type) {
    case 'workspace.created':
      return `Workspace ${ev.payload.workspaceId} opens with ${ev.payload.fileCount} ${ev.payload.fileCount === 1 ? 'file' : 'files'}`;
    case 'member.created':
      return `${ev.payload.name ?? who(ev.payload.memberId)} joins the team`;
    case 'member.online':
      return `${who(ev.payload.memberId)} comes online`;
    case 'member.offline':
      return `${who(ev.payload.memberId)} goes offline`;
    case 'member.reconnected':
      return `${who(ev.payload.memberId)} is back online`;
    case 'member.stale':
      return `${who(ev.payload.memberId)}'s computer stopped responding`;
    case 'file.changed':
      return `${who(ev.payload.by)}'s Bob changes ${basename(ev.payload.path)}`;
    case 'file.deleted':
      return `${who(ev.payload.by)}'s Bob deletes ${basename(ev.payload.path)}`;
    case 'file.rejected':
      return ev.payload.holderMemberId
        ? `${who(ev.payload.by)}'s change to ${basename(ev.payload.path)} is refused, ${who(ev.payload.holderMemberId)} holds it`
        : `${who(ev.payload.by)}'s change to ${basename(ev.payload.path)} is refused (${ev.payload.reason})`;
    case 'lock.reserved':
      return `${basename(ev.payload.path)} is reserved for ${who(ev.payload.memberId)} (${ev.payload.taskId})`;
    case 'lock.acquired':
      return `${who(ev.payload.memberId)} now holds ${basename(ev.payload.path)} (${ev.payload.taskId})`;
    case 'lock.review':
      return `${basename(ev.payload.path)} is held for review (${ev.payload.taskId})`;
    case 'lock.released':
      return `${ev.payload.taskId} releases ${basename(ev.payload.path)}`;
    case 'lock.transferred':
      return `${basename(ev.payload.path)} passes to ${who(ev.payload.toMemberId)} (${ev.payload.toTaskId})`;
    case 'lock.queued':
      return `${who(ev.payload.memberId)} is #${ev.payload.pos} in the queue for ${basename(ev.payload.path)}`;
    case 'lock.revoked':
      return `The lock on ${basename(ev.payload.path)} is taken back from ${who(ev.payload.memberId)}`;
    case 'lock.blocked':
      return `${who(ev.payload.memberId)}'s Bob is blocked on ${basename(ev.payload.path)}, ${who(ev.payload.holderMemberId)} holds it`;
    case 'task.created':
      return `${ev.payload.taskId} “${ev.payload.title}” goes to ${who(ev.payload.ownerId)}`;
    case 'task.status':
      return `${ev.payload.taskId} is now ${TASK_STATUS_TEXT[ev.payload.to] ?? ev.payload.to}`;
    case 'task.submitted':
      return `${who(ev.actor)} submits ${ev.payload.taskId} for review`;
    case 'request.created':
      return ev.payload.holderMemberId
        ? `${who(ev.payload.requesterMemberId)} asks for ${basename(ev.payload.path)}, ${who(ev.payload.holderMemberId)} holds it`
        : `${who(ev.payload.requesterMemberId)} asks for ${basename(ev.payload.path)}`;
    case 'request.decided':
      return `Request ${ev.payload.requestId}: ${OUTCOME_TEXT[ev.payload.outcome] ?? ev.payload.outcome}${ev.payload.auto ? ' (automatic)' : ''}`;
    case 'proposal.created':
      return `${who(ev.actor)}'s Bob (PM) proposes a ${ev.payload.kind} (${ev.payload.proposalId})`;
    case 'proposal.decided':
      return `${ev.payload.proposalId} ${PROPOSAL_STATUS_TEXT[ev.payload.status] ?? ev.payload.status}`;
    case 'review.created':
      return `Review of ${ev.payload.taskId}: ${VERDICT_TEXT[ev.payload.verdict] ?? ev.payload.verdict}`;
    case 'review.flagged':
      return `Review of ${ev.payload.taskId} flags ${ev.payload.flags.length} ${ev.payload.flags.length === 1 ? 'file' : 'files'}`;
    case 'notify.sent':
      return `PM to ${who(ev.payload.memberId)}: ${ev.payload.message}`;
    case 'commit.created':
      return `${ev.payload.taskId} lands as commit ${ev.payload.sha.slice(0, 7)}${ev.payload.pushed ? '' : ' (not pushed yet)'}`;
    case 'commit.push_failed':
      return `Pushing ${ev.payload.taskId} failed: ${ev.payload.error}`;
    case 'bob.said':
      return `${who(ev.payload.memberId)}'s Bob: ${ev.payload.text}`;
    case 'sync.applied':
    case 'hook.failopen':
    case 'ai.edit':
    case 'bob.activity':
    case 'bob.turn':
      return null;
  }
}

/**
 * Feed line such as `21:06 Andi's Bob changes checkout.ts`. `names` maps member ids to names; ids
 * without a name stay as ids. Returns null for events that stay out of the feed
 * (`sync.applied`, `hook.failopen`, `ai.edit`, `bob.activity`, `bob.turn`).
 */
export function feedText(ev: RadarEvent, names: FeedNames = {}): string | null {
  const s = sentence(ev, names);
  return s === null ? null : `${formatClock(ev.ts)} ${s}`;
}
