// `POST /v1/locks/check` (R3 §2.2): checkWrite for every path in one transaction, plus the message the hook
// prints on stderr when anything is blocked.
import type { CheckReason, LockCheckRes, LockCheckResult, LockHolder } from '@radar/common';
import { getMember } from '../db/repo/member';
import { checkWrite, type LockCtx } from './locks';

/** Paths per call (fase 05 step 3). The schema allows more; the route rejects the rest with 422. */
export const LOCK_CHECK_MAX_PATHS = 20;

function heldText(reason: CheckReason, h: LockHolder | null | undefined): string {
  const who = h ? `${h.memberName} (${h.taskId} ${h.taskTitle})` : 'rekan lain';
  switch (reason) {
    case 'reserved_by_other':
      return `sudah dipesan untuk Bob milik ${who}`;
    case 'in_review_by_other':
      return `sedang di-review, milik ${who}`;
    case 'committing':
      return `sedang di-commit, milik ${who}`;
    default:
      return `sedang dipegang Bob milik ${who}`;
  }
}

/** R3 §2.2 message template. Names the first blocked path and how many more there are. */
export function blockMessage(blocked: readonly LockCheckResult[], activeTaskId: string | null): string {
  const first = blocked[0];
  if (!first) return '';
  if (first.reason === 'pm_readonly') {
    return 'RADAR: PM hanya membaca dan tidak boleh mengubah file. Edit dibatalkan. Usulkan perubahan lewat radar propose_* ke Mission Control.';
  }
  const more = blocked.length > 1 ? ` (dan ${blocked.length - 1} file lain)` : '';
  const next = activeTaskId ? `lalu kerjakan bagian lain dari task ${activeTaskId}.` : 'lalu tunggu keputusan PM.';
  return (
    `RADAR: ${first.path}${more} ${heldText(first.reason, first.holder)}. Edit dibatalkan. ` +
    `Jangan coba ulang dan jangan ubah lewat shell. Panggil radar why_blocked, beri tahu user, ${next}`
  );
}

/** Runs inside the caller's transaction; `paths` are already clean and unique. */
export function checkPaths(ctx: LockCtx, memberId: string, paths: readonly string[]): Omit<LockCheckRes, 'serverMs'> {
  const results: LockCheckResult[] = paths.map((path) => {
    const r = checkWrite(ctx, memberId, path, 'hook');
    return { path, decision: r.decision, reason: r.reason, holder: r.holder, requestId: r.requestId, queuePos: r.queuePos };
  });
  const blocked = results.filter((r) => r.decision === 'block');
  const activeTaskId = getMember(ctx.db, memberId)?.active_task_id ?? null;
  return { decision: blocked.length > 0 ? 'block' : 'allow', results, activeTaskId, message: blockMessage(blocked, activeTaskId) };
}
