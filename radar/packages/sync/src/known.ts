// `known`: the last version + hash agreed with the server per path (from snapshot, ack or changed).
// It drives anti-echo (SY-03): a watcher event whose hash equals `known` is our own write.

export interface KnownEntry {
  version: number;
  hash: string;
}

export class KnownStore {
  private readonly map = new Map<string, KnownEntry>();

  get(path: string): KnownEntry | undefined {
    return this.map.get(path);
  }

  /** Stores `entry` unless it is older than what we already know. Returns false for a stale entry. */
  set(path: string, entry: KnownEntry): boolean {
    const cur = this.map.get(path);
    if (cur && entry.version < cur.version) return false;
    this.map.set(path, { version: entry.version, hash: entry.hash });
    return true;
  }

  delete(path: string): void {
    this.map.delete(path);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  /** `hello.knownVersions`: agreed versions only (version 0 means "never agreed"). */
  versions(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [path, e] of this.map) if (e.version > 0) out[path] = e.version;
    return out;
  }
}
