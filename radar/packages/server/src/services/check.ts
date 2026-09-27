// `POST /v1/locks/check` (R3 §2.2): checkWrite for every path in one transaction, plus the message the hook
// prints on stderr when anything is blocked.
import { rangeText, type CheckReason, type LineRange, type LockCheckRes, type LockCheckResult, type LockHolder } from '@radar/common';
import { getMember } from '../db/repo/member';
import { checkWrite, type LockCtx } from './locks';

/** Paths per call (fase 05 step 3). The schema allows more; the route rejects the rest with 422. */
export const LOCK_CHECK_MAX_PATHS = 20;

function heldText(reason: CheckReason, h: LockHolder | null | undefined): string {
  const who = h ? `${h.memberName}'s Bob (${h.taskId} ${h.taskTitle})` : 'a teammate';
  // D-alief-17: a range lock names the lines ("lines 3–5 are locked by Alice").
  if (h?.range && reason === 'held_by_other') {
    return `${rangeText(h.range)} ${h.range.start === h.range.end ? 'is' : 'are'} locked by ${h.memberName} (${h.taskId} ${h.taskTitle})`;
  }
  switch (reason) {
    case 'reserved_by_other':
      return `is reserved for ${who}`;
    case 'in_review_by_other':
      return `is in review, held by ${who}`;
    case 'committing':
      return `is being committed by ${who}`;
    default:
      return `is held by ${who}`;
  }
}

/** R3 §2.2 message template. Names the first blocked path and how many more there are. */
export function blockMessage(blocked: readonly LockCheckResult[], activeTaskId: string | null): string {
  const first = blocked[0];
  if (!first) return '';
  if (first.reason === 'pm_readonly') {
    return 'RADAR: a PM only reads and may not change files. Edit cancelled. Propose the change to Mission Control with radar propose_*.';
  }
  const more = blocked.length > 1 ? ` (and ${blocked.length - 1} more ${blocked.length === 2 ? 'file' : 'files'})` : '';
  const next = activeTaskId ? `then work on another part of task ${activeTaskId}.` : "then wait for the PM's decision.";
  return (
    `RADAR: ${first.path}${more} ${heldText(first.reason, first.holder)}. Edit cancelled. ` +
    `Do not retry and do not change it through the shell. Call radar why_blocked, tell the user, ${next}`
  );
}

/** Runs inside the caller's transaction; `paths` are already clean and unique. */
export function checkPaths(
  ctx: LockCtx,
  memberId: string,
  paths: readonly string[],
  lines: Readonly<Record<string, readonly LineRange[]>> = {},
): Omit<LockCheckRes, 'serverMs'> {
  const results: LockCheckResult[] = paths.map((path) => {
    const r = checkWrite(ctx, memberId, path, 'hook', Object.hasOwn(lines, path) ? lines[path]! : null);
    return { path, decision: r.decision, reason: r.reason, holder: r.holder, requestId: r.requestId, queuePos: r.queuePos };
  });
  const blocked = results.filter((r) => r.decision === 'block');
  const activeTaskId = getMember(ctx.db, memberId)?.active_task_id ?? null;
  return { decision: blocked.length > 0 ? 'block' : 'allow', results, activeTaskId, message: blockMessage(blocked, activeTaskId) };
}
