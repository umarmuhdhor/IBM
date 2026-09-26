// Commit of an approved task (R4 §6.3 step 2). Fase 05 ships a stub so the two-transaction flow can be tested;
// fase 06 replaces it with the GitHub Git Data API (trees → commits → PATCH ref, no force).

export interface CommitFile {
  path: string;
  /** null deletes the file. */
  content: string | null;
}

export interface CommitReviewer {
  name: string;
  role: string;
  email: string;
}

export interface CommitSnapshot {
  taskId: string;
  title: string;
  summary: string | null;
  author: { name: string; email: string };
  baseCommit: string | null;
  branch: string;
  proposalId: string | null;
  reviewer: CommitReviewer | null;
  files: CommitFile[];
}

export interface CommitResult {
  sha: string;
  pushed: boolean;
  url?: string;
  /** True when the tree already matched the base (no commit or ref update made). */
  empty?: boolean;
}

export interface GitHubCommitter {
  /** Throws on any failure; the caller releases the claim and emits `commit.push_failed`. */
  commitTask(snapshot: CommitSnapshot): Promise<CommitResult>;
  /** Fresh head of `branch`, or null when it cannot be read. Used after a non-fast-forward. */
  refreshHead?(branch: string): Promise<string | null>;
}

/** Fake sha of the fase 05 stub. Fase 06 DoD requires a test that fails when this value reaches a task. */
export const PENDING_COMMIT_SHA = 'pending-fase-06';

export const stubCommitter: GitHubCommitter = {
  commitTask: () => Promise.resolve({ sha: PENDING_COMMIT_SHA, pushed: false }),
};
