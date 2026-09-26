// `.radar/sync.log` (fase 04 step 10): one line per event, rotated to sync.log.1 above 5 MB. Never logs tokens.
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type SyncLog = (event: string, detail?: string) => void;

const TOKEN_RE = /rdr_[A-Za-z0-9_-]+/g;

export function createSyncLog(root: string, opts: { maxBytes?: number; echo?: (line: string) => void } = {}): SyncLog {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const dir = join(root, '.radar');
  const file = join(dir, 'sync.log');
  mkdirSync(dir, { recursive: true });
  let size = 0;
  try {
    size = statSync(file).size;
  } catch {
    size = 0;
  }
  let warned = false;
  return (event, detail = '') => {
    const line = `${new Date().toISOString()} ${event}${detail ? ` ${detail.replace(TOKEN_RE, 'rdr_***')}` : ''}\n`;
    opts.echo?.(line.trimEnd());
    const bytes = Buffer.byteLength(line);
    try {
      if (size + bytes > maxBytes) {
        renameSync(file, `${file}.1`);
        size = 0;
      }
      appendFileSync(file, line);
      size += bytes;
    } catch (err) {
      // The log is diagnostics only; a full disk must not stop syncing. Report once on stderr.
      if (!warned) {
        warned = true;
        console.error(`radar: cannot write ${file}: ${(err as Error).message}`);
      }
    }
  };
}
