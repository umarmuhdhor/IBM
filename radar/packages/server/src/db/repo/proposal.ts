// `proposal` rows (R2 §2): plans, decisions and reviews from the main agent. A proposal leaves `menunggu`
// only through `decideProposal` (I7), which refuses any other starting status.
import type { ProposalKind, ProposalStatus } from '@radar/common';
import type { Db } from '../sql';
import { nextCounter } from './counter';

export interface ProposalRow {
  [k: string]: string | number | null;
  id: string;
  seq: number;
  kind: ProposalKind;
  status: ProposalStatus;
  payload: string;
  reason: string;
  ref_id: string | null;
  created_by: string;
  created_at: number;
  decided_by: string | null;
  decided_at: number | null;
  decision_note: string | null;
}

export function insertProposal(
  db: Db,
  p: { kind: ProposalKind; payload: string; reason: string; refId: string | null; createdBy: string; now: number },
): ProposalRow {
  const seq = nextCounter(db, 'proposal');
  const row = db.one<ProposalRow>(
    "INSERT INTO proposal (id, seq, kind, status, payload, reason, ref_id, created_by, created_at) VALUES (?, ?, ?, 'menunggu', ?, ?, ?, ?, ?) RETURNING *",
    `P-${seq}`,
    seq,
    p.kind,
    p.payload,
    p.reason,
    p.refId,
    p.createdBy,
    p.now,
  );
  if (!row) throw new Error('proposal insert returned no row');
  return row;
}

export function getProposal(db: Db, id: string): ProposalRow | null {
  return db.one<ProposalRow>('SELECT * FROM proposal WHERE id = ?', id);
}

export function listProposals(db: Db, status?: ProposalStatus): ProposalRow[] {
  if (!status) return db.all<ProposalRow>('SELECT * FROM proposal ORDER BY seq');
  return db.all<ProposalRow>('SELECT * FROM proposal WHERE status = ? ORDER BY seq', status);
}

/** Moves a `menunggu` proposal to `status`. Returns false when it was not `menunggu` any more. */
export function decideProposal(db: Db, id: string, status: Exclude<ProposalStatus, 'menunggu'>, decidedBy: string, now: number, note: string | null = null): boolean {
  return (
    db.run(
      "UPDATE proposal SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ? AND status = 'menunggu'",
      status,
      decidedBy,
      now,
      note,
      id,
    ) > 0
  );
}

/** Marks every other `menunggu` review proposal of `taskId` `kedaluwarsa`; returns their ids. */
/** Expires waiting `decision` proposals of a request that closed without them (its task ended). */
export function expirePendingDecisions(db: Db, requestId: string): string[] {
  return db
    .all<{ id: string }>("UPDATE proposal SET status = 'kedaluwarsa' WHERE kind = 'decision' AND status = 'menunggu' AND ref_id = ? RETURNING id", requestId)
    .map((r) => r.id)
    .sort();
}

export function expirePendingReviews(db: Db, taskId: string, exceptId: string | null = null): string[] {
  return db
    .all<{ id: string }>(
      "UPDATE proposal SET status = 'kedaluwarsa' WHERE kind = 'review' AND status = 'menunggu' AND ref_id = ? AND id IS NOT ? RETURNING id",
      taskId,
      exceptId,
    )
    .map((r) => r.id)
    .sort();
}
