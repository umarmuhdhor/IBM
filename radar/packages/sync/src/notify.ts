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
      return `✖ PM tidak menulis file. Perubahan disimpan di ${saved ?? '(tidak ada salinan)'}.`;
    case 'conflict':
      return `✖ Versi lokal tertinggal, isi server dipakai. Salinanmu: ${saved ?? '(tidak ada salinan)'}`;
    case 'too_large':
      return `✖ ${r.path} lebih dari 1 MB, tidak disinkronkan.`;
    case 'binary':
      return `✖ ${r.path} file biner, tidak disinkronkan.`;
    case 'held_by_other':
    case 'committing': {
      const who = r.holder ? `dipegang ${r.holder.memberName} (${r.holder.taskId} ${r.holder.taskTitle})` : 'dipegang anggota lain';
      const why = r.reason === 'committing' ? `sedang di-commit${r.holder ? ` (${r.holder.taskId})` : ''}` : who;
      return `✖ Perubahanmu di ${r.path} ditolak: ${why}.${saved ? ` Isimu disimpan di ${saved}.` : ''}`;
    }
  }
}

/** Prints notices to a stream; errors ring the terminal bell. */
export function terminalNotifier(write: (s: string) => void = (s) => process.stderr.write(s)): Notifier {
  return (n) => {
    if (n.level === 'error') write(`\x07${pc.red(n.text)}\n`);
    else if (n.level === 'warn') write(`${pc.yellow(n.text)}\n`);
    else write(`${n.text}\n`);
  };
}
