// `review` rows (R2 §2): the verdict applied when Mission Control approves a review proposal.
import type { ReviewVerdict } from '@radar/common';
import type { Db } from '../sql';
import { nextCounter } from './counter';

export interface ReviewRow {
  [k: string]: string | number | null;
  id: string;
  seq: number;
  task_id: string;
  proposal_id: string;
  verdict: ReviewVerdict;
  notes: string;
  commit_sha: string | null;
  created_at: number;
}

export function insertReview(
  db: Db,
  r: { taskId: string; proposalId: string; verdict: ReviewVerdict; notes: string; commitSha: string | null; now: number },
): ReviewRow {
  const seq = nextCounter(db, 'review');
  const row = db.one<ReviewRow>(
    'INSERT INTO review (id, seq, task_id, proposal_id, verdict, notes, commit_sha, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
    `RV-${seq}`,
    seq,
    r.taskId,
    r.proposalId,
    r.verdict,
    r.notes,
    r.commitSha,
    r.now,
  );
  if (!row) throw new Error('review insert returned no row');
  return row;
}
