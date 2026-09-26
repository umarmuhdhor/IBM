// Sidecar copies (SY-04): the local content that lost, saved next to the file as is so it can be copied back.
import { atomicWrite } from './writer.js';

export type SidecarKind = 'rejected' | 'conflict';

/** Writes `<rel>.radar-<kind>` (overwriting an older one) and returns its workspace-relative path. */
export function writeSidecar(root: string, rel: string, kind: SidecarKind, content: string | Buffer): string {
  const sidecar = `${rel}.radar-${kind}`;
  atomicWrite(root, sidecar, content);
  return sidecar;
}
