// Commit of an approved task (R4 §6.3 step 2). Fase 05 ships a stub so the two-transaction flow can be tested;
// fase 06 replaces it with the GitHub Git Data API (trees → commits → PATCH ref, no force).

export interface CommitFile {
  path: string;
  /** null deletes the file. */
  content: string | null;
}

export interface CommitSnapshot {
  taskId: string;
  title: string;
  summary: string | null;
  author: { name: string; email: string };
  baseCommit: string | null;
  files: CommitFile[];
}

export interface CommitResult {
  sha: string;
  pushed: boolean;
  url?: string;
}

export interface GitHubCommitter {
  /** Throws on any failure; the caller releases the claim and emits `commit.push_failed`. */
  commitTask(snapshot: CommitSnapshot): Promise<CommitResult>;
}

/** Fake sha of the fase 05 stub. Fase 06 DoD requires a test that fails when this value reaches a task. */
export const PENDING_COMMIT_SHA = 'pending-fase-06';

export const stubCommitter: GitHubCommitter = {
  commitTask: () => Promise.resolve({ sha: PENDING_COMMIT_SHA, pushed: false }),
};
