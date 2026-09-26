export type RadarWsUpdate =
  | { kind: 'status'; connected: boolean }
  | { kind: 'state'; data: unknown }
  | { kind: 'event'; data: unknown; latencyMs: number | null }
