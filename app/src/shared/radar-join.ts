import type { RadarConnectionSummary } from './radar-connection'

// IN-03 (D-alief-09): join a workspace with a short code, and make codes from Mission Control.

/** Server a code is redeemed on when the user does not type one. */
export const DEFAULT_RADAR_SERVER = 'https://live-collab.afindo-mi01.workers.dev'

export type RadarSyncStatus = {
  state: 'stopped' | 'starting' | 'syncing' | 'error'
  folder: string | null
  files: number | null
  message: string | null
  /** Files whose local copy differed from the server; each is kept as `<path>.radar-conflict` (D-alief-14). */
  conflicts: string[]
  /** Why sync ended for good, from the CLI's `stopped` line (D-alief-15); null while running or after a crash. */
  stopReason: RadarSyncStopReason | null
  /** Why the last local change was not sent (PM read-only, file held by a task, too large); kept as `.radar-rejected`. */
  rejected?: string | null
  /** The Bob kit was not installed in the folder (`.bob/` holds other files, or the kit is missing); null once it is. */
  kit?: RadarKitNotice | null
}

export type RadarKitNotice = { status: 'refused' | 'missing-kit'; message: string }

export type RadarSyncStopReason = 'workspace-closed' | 'signed-out' | 'replaced' | 'rejected'

export type RadarJoinResult = {
  connection: RadarConnectionSummary
  /** 'mc' after an owner code (D-alief-11); Mission Control has no synced folder. */
  role: 'coder' | 'pm' | 'mc'
  folder: string | null
  /** Where a leftover folder of the same workspace was moved before joining (D-alief-14). */
  previousFolder: string | null
}

/** `member` is null for an open code: whoever uses it first joins with their own name and role. */
export type RadarJoinCode = {
  member: string | null
  code: string
  expiresAt: number
}

export type RadarJoinRole = 'coder' | 'pm'

/** D-alief-12: the owner's folder became the workspace; `code` is the first open code (already copied). */
export type RadarOpenFolderResult = {
  connection: RadarConnectionSummary
  folder: string
  files: number
  skipped: number
  code: RadarJoinCode
}
