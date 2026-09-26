export type RadarConnection = {
  server: string
  workspace: string
  member: string
  role: 'coder' | 'pm' | 'mc'
  token: string
}

export type RadarConnectionSummary = Omit<RadarConnection, 'token'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isServerAddress(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.pathname === '/' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

export function isRadarConnection(value: unknown): value is RadarConnection {
  return (
    isRecord(value) &&
    typeof value.server === 'string' &&
    isServerAddress(value.server) &&
    typeof value.workspace === 'string' &&
    value.workspace.trim().length > 0 &&
    typeof value.member === 'string' &&
    value.member.trim().length > 0 &&
    (value.role === 'coder' || value.role === 'pm' || value.role === 'mc') &&
    typeof value.token === 'string' &&
    value.token.length > 0
  )
}
