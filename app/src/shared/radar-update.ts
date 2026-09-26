export type RadarConnectionFailure = 'access-rejected' | 'connection-lost'

export type RadarWsUpdate =
  | { kind: 'status'; connected: boolean; failure?: RadarConnectionFailure }
  | { kind: 'state'; data: unknown }
  | { kind: 'event'; data: unknown; latencyMs: number | null }
