import type { RadarConnectionSummary } from './radar-connection'

// IN-03 (D-alief-09): join a workspace with a short code, and make codes from Mission Control.

/** Server a code is redeemed on when the user does not type one. */
export const DEFAULT_RADAR_SERVER = 'https://live-collab.afindo-mi01.workers.dev'

export type RadarSyncStatus = {
  state: 'stopped' | 'starting' | 'syncing' | 'error'
  folder: string | null
  files: number | null
  message: string | null
}

export type RadarJoinResult = {
  connection: RadarConnectionSummary
  role: 'coder' | 'pm'
  folder: string
}

/** `member` is null for an open code: whoever uses it first joins with their own name and role. */
export type RadarJoinCode = { member: string | null; code: string; expiresAt: number }

export type RadarJoinRole = 'coder' | 'pm'
