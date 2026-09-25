export type RadarConnection = {
  server: string
  workspace: string
  member: string
  role: 'coder' | 'mc'
  token: string
}

export type RadarConnectionSummary = Omit<RadarConnection, 'token'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isRadarConnection(value: unknown): value is RadarConnection {
  return (
    isRecord(value) &&
    typeof value.server === 'string' &&
    value.server.trim().length > 0 &&
    typeof value.workspace === 'string' &&
    value.workspace.trim().length > 0 &&
    typeof value.member === 'string' &&
    value.member.trim().length > 0 &&
    (value.role === 'coder' || value.role === 'mc') &&
    typeof value.token === 'string' &&
    value.token.length > 0
  )
}
