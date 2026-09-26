// Event catalog (R3 §5) and the Indonesian feed sentences shown in Mission Control and the replay.
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

const PROPOSAL_KIND_TEXT = { plan: 'rencana', decision: 'keputusan', review: 'review' } as const;

function sentence(ev: RadarEvent): string | null {
  switch (ev.type) {
    case 'workspace.created':
      return `Workspace ${ev.payload.workspaceId} dibuat (${ev.payload.fileCount} file)`;
    case 'member.created':
      return `${ev.payload.name ?? ev.payload.memberId} bergabung`;
    case 'member.online':
      return `${ev.payload.memberId} terhubung`;
    case 'member.offline':
      return `${ev.payload.memberId} terputus`;
    case 'member.reconnected':
      return `${ev.payload.memberId} tersambung ulang`;
    case 'member.stale':
      return `PC ${ev.payload.memberId} tidak merespons`;
    case 'file.changed':
      return `Bob ${ev.payload.by} ubah ${basename(ev.payload.path)}`;
    case 'file.deleted':
      return `Bob ${ev.payload.by} hapus ${basename(ev.payload.path)}`;
    case 'file.rejected':
      return ev.payload.holderMemberId
        ? `Perubahan ${ev.payload.by} di ${basename(ev.payload.path)} ditolak (milik ${ev.payload.holderMemberId})`
        : `Perubahan ${ev.payload.by} di ${basename(ev.payload.path)} ditolak (${ev.payload.reason})`;
    case 'lock.reserved':
      return `${basename(ev.payload.path)} dipesan untuk ${ev.payload.memberId} (${ev.payload.taskId})`;
    case 'lock.acquired':
      return `${ev.payload.memberId} memegang ${basename(ev.payload.path)} (${ev.payload.taskId})`;
    case 'lock.review':
      return `${basename(ev.payload.path)} masuk review (${ev.payload.taskId})`;
    case 'lock.released':
      return `${basename(ev.payload.path)} dilepas ${ev.payload.taskId}`;
    case 'lock.transferred':
      return `${basename(ev.payload.path)} pindah ke ${ev.payload.toMemberId} (${ev.payload.toTaskId})`;
    case 'lock.queued':
      return `${ev.payload.memberId} antre ${basename(ev.payload.path)} (#${ev.payload.pos})`;
    case 'lock.revoked':
      return `Kunci ${basename(ev.payload.path)} dicabut dari ${ev.payload.memberId}`;
    case 'lock.blocked':
      return `Bob ${ev.payload.memberId} diblokir di ${basename(ev.payload.path)} (milik ${ev.payload.holderMemberId})`;
    case 'task.created':
      return `Task ${ev.payload.taskId} ${ev.payload.title} dibuat untuk ${ev.payload.ownerId}`;
    case 'task.status':
      return `${ev.payload.taskId}: ${ev.payload.from} → ${ev.payload.to}`;
    case 'task.submitted':
      return `${ev.actor} submit ${ev.payload.taskId}`;
    case 'request.created':
      return ev.payload.holderMemberId
        ? `${ev.payload.requesterMemberId} minta ${basename(ev.payload.path)} (dipegang ${ev.payload.holderMemberId})`
        : `${ev.payload.requesterMemberId} minta ${basename(ev.payload.path)}`;
    case 'request.decided':
      return `Permintaan ${ev.payload.requestId}: ${ev.payload.outcome}${ev.payload.auto ? ' (otomatis)' : ''}`;
    case 'proposal.created':
      return `Main agent mengusulkan ${PROPOSAL_KIND_TEXT[ev.payload.kind]} ${ev.payload.proposalId}`;
    case 'proposal.decided':
      return `${ev.payload.proposalId} ${ev.payload.status}`;
    case 'review.created':
      return `Review ${ev.payload.taskId}: ${ev.payload.verdict}`;
    case 'review.flagged':
      return `Review ${ev.payload.taskId} menandai ${ev.payload.flags.length} file`;
    case 'notify.sent':
      return `PM ke ${ev.payload.memberId}: ${ev.payload.message}`;
    case 'commit.created':
      return `Commit ${ev.payload.sha.slice(0, 7)} untuk ${ev.payload.taskId}${ev.payload.pushed ? '' : ' (belum di-push)'}`;
    case 'commit.push_failed':
      return `Commit ${ev.payload.taskId} gagal: ${ev.payload.error}`;
    case 'bob.said':
      return `Bob ${ev.payload.memberId}: ${ev.payload.text}`;
    case 'sync.applied':
    case 'hook.failopen':
    case 'ai.edit':
    case 'bob.activity':
    case 'bob.turn':
      return null;
  }
}

/**
 * Feed line such as `21:06 Bob A ubah checkout.ts`. Returns null for events that stay out of the feed
 * (`sync.applied`, `hook.failopen`, `ai.edit`, `bob.activity`, `bob.turn`).
 */
export function feedText(ev: RadarEvent): string | null {
  const s = sentence(ev);
  return s === null ? null : `${formatClock(ev.ts)} ${s}`;
}
