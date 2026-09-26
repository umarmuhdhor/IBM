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

export type RadarJoinCode = { member: string; code: string; expiresAt: number }
