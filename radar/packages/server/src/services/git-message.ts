/**
 * Formats a Git commit message following the Radar R5 §3 commit format.
 */

export interface CommitMessageInput {
  taskId: string;
  title: string;
  summary: string | null;
  proposalId: string | null;
  reviewer: { name: string; role: string; email: string } | null;
  coauthor: string;
}

/**
 * Returns a formatted commit message string.
 *
 * Layout:
 *   <TASKID>: <TITLE>
 *   <blank line>
 *   [<SUMMARY>]
 *   <blank line>
 *   Radar-Task: <TASKID>
 *   [Radar-Main-Agent-Proposal: <PROPOSALID>]
 *   [Reviewed-by: <NAME> (<ROLE-UPPER>) <<EMAIL>>]
 *   Co-authored-by: <COAUTHOR>
 *
 * Lines wrapped in [...] are omitted when their value is null or empty string.
 */
export function formatCommitMessage(input: CommitMessageInput): string {
  const { taskId, title, summary, proposalId, reviewer, coauthor } = input;

  // Subject line
  const subject = `${taskId}: ${title}`;

  // Trailer lines
  const trailerLines: string[] = [];
  trailerLines.push(`Radar-Task: ${taskId}`);

  if (proposalId) {
    trailerLines.push(`Radar-Main-Agent-Proposal: ${proposalId}`);
  }

  if (reviewer) {
    // Uppercase the role per spec ('pm' → 'PM', 'coder' → 'CODER')
    const roleUpper = reviewer.role.toUpperCase();
    trailerLines.push(`Reviewed-by: ${reviewer.name} (${roleUpper}) <${reviewer.email}>`);
  }

  trailerLines.push(`Co-authored-by: ${coauthor}`);

  // Assemble: subject, one blank line, optional summary paragraph, one blank line, trailers.
  const parts: string[] = [subject, ''];
  if (summary) {
    parts.push(summary, '');
  }
  parts.push(...trailerLines);

  return parts.join('\n');
}
