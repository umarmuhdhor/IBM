// Terminal notices (fase 04 step 6): red + bell for rejections, yellow for warnings.
import pc from 'picocolors';
import type { LockHolder } from '@radar/common';
import { basename } from '@radar/common';

export type RejectReason = 'held_by_other' | 'committing' | 'pm_readonly' | 'conflict' | 'too_large' | 'binary';

export interface Notice {
  level: 'error' | 'warn' | 'info';
  text: string;
}

export type Notifier = (n: Notice) => void;

export function formatRejection(r: { path: string; reason: RejectReason; holder: LockHolder | null; sidecar: string | null }): string {
  const saved = r.sidecar ? basename(r.sidecar) : null;
  switch (r.reason) {
    case 'pm_readonly':
      return `✖ A PM does not write files. Your change is kept in ${saved ?? '(no copy)'}.`;
    case 'conflict':
      return `✖ Your copy was behind, so the server version is used. Your copy: ${saved ?? '(no copy)'}`;
    case 'too_large':
      return `✖ ${r.path} is larger than 1 MB and does not sync.`;
    case 'binary':
      return `✖ ${r.path} is a binary file and does not sync.`;
    case 'held_by_other':
    case 'committing': {
      const who = r.holder ? `held by ${r.holder.memberName} (${r.holder.taskId} ${r.holder.taskTitle})` : 'held by another member';
      const why = r.reason === 'committing' ? `being committed${r.holder ? ` (${r.holder.taskId})` : ''}` : who;
      return `✖ Your change to ${r.path} was refused: ${why}.${saved ? ` Your content is kept in ${saved}.` : ''}`;
    }
  }
}

/** Prints notices to a stream; errors ring the terminal bell. `plain` drops the bell and colors (app output). */
export function terminalNotifier(write: (s: string) => void = (s) => process.stderr.write(s), o: { plain?: boolean } = {}): Notifier {
  return (n) => {
    if (o.plain) return write(`${n.text}\n`);
    if (n.level === 'error') write(`\x07${pc.red(n.text)}\n`);
    else if (n.level === 'warn') write(`${pc.yellow(n.text)}\n`);
    else write(`${n.text}\n`);
  };
}
