/**
 * TaskCard — compact card for a task in the Mission Control tasks column.
 *
 * Shows:  T-<id> title, owner chip, file count + edit count, status badge.
 *
 * Status vocabulary (from types):
 *   terbuka   → open (dim)
 *   draf      → draft (dim)
 *   dikerjakan → working
 *   review    → review (needs PM)
 *   selesai   → done (with commit sha)
 *   batal     → cancelled
 */
import { MemberChip } from './MemberChip';
import type { MemberOnlineStatus } from './MemberChip';
import type { MemberId, TaskStatus } from './types';

export interface TaskCardProps {
  /** Task identifier, e.g. "T-1". */
  id: string;
  /** Human-readable task title. */
  title: string;
  /** Member who owns the task. */
  ownerId: MemberId;
  /** Single-char initials for the owner chip. */
  ownerInitials: string;
  /** Current presence of the task owner. Defaults to offline when unknown. */
  ownerStatus?: MemberOnlineStatus;
  /** Current task status. */
  status: TaskStatus;
  /** Number of files being worked on. */
  fileCount?: number;
  /** Total number of edits made so far. */
  editCount?: number;
  /** Commit SHA when the task is done. */
  commitSha?: string | null;
  /** Optional CSS class. */
  className?: string;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  terbuka: 'open',
  draf: 'draft',
  dikerjakan: 'working',
  review: 'waiting PM',
  selesai: 'done',
  batal: 'cancelled',
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  terbuka: 'var(--lc-text-faint)',
  draf: 'var(--lc-text-faint)',
  dikerjakan: 'var(--lc-ok)',
  review: 'var(--lc-needs-you)',
  selesai: 'var(--lc-text-muted)',
  batal: 'var(--lc-text-faint)',
};

export function TaskCard({
  id,
  title,
  ownerId,
  ownerInitials,
  ownerStatus = 'offline',
  status,
  fileCount,
  editCount,
  commitSha,
  className,
}: TaskCardProps) {
  const isDim = status === 'terbuka' || status === 'draf' || status === 'batal';
  const isDone = status === 'selesai';

  return (
    <div
      role="article"
      aria-label={`Task ${id}: ${title}, ${STATUS_LABEL[status]}`}
      data-status={status}
      className={['lc-task-card', className].filter(Boolean).join(' ')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px 10px',
        borderRadius: '10px',
        background: 'var(--lc-surface-2)',
        border: '1px solid var(--lc-border)',
        fontFamily: 'var(--lc-font-sans)',
        fontSize: '13px',
        color: 'var(--lc-text)',
        opacity: isDim ? 0.6 : 1,
      }}
    >
      {/* Header row: task ID + owner chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            fontFamily: 'var(--lc-font-mono)',
            fontSize: '11px',
            color: 'var(--lc-text-faint)',
          }}
        >
          {id}
        </span>
        <MemberChip member={ownerId} initials={ownerInitials} status={ownerStatus} />
      </div>

      {/* Title */}
      <div style={{ fontWeight: 500, lineHeight: '20px' }}>{title}</div>

      {/* Meta row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: 'var(--lc-text-muted)',
        }}
      >
        {fileCount !== undefined && (
          <span>{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
        )}
        {editCount !== undefined && (
          <span>{editCount} edits</span>
        )}
        {isDone && commitSha && (
          <span
            style={{
              fontFamily: 'var(--lc-font-mono)',
              fontSize: '11px',
              color: 'var(--lc-text-faint)',
            }}
          >
            {commitSha.slice(0, 7)}
          </span>
        )}
      </div>

      {/* Status badge */}
      <div
        style={{
          fontSize: '11px',
          fontFamily: 'var(--lc-font-mono)',
          color: STATUS_COLOR[status],
        }}
      >
        {STATUS_LABEL[status]}
      </div>
    </div>
  );
}
