/**
 * 'workspace-closed': the owner stopped sharing or switched folders; 'signed-out': the same seat signed in on
 * another device (D-alief-15). Neither is fixed by a different token, so the token form stays closed.
 */
export type RadarConnectionFailure =
  | 'access-rejected'
  | 'connection-lost'
  | 'workspace-closed'
  | 'signed-out'
  /** D-alief-20: the owner removed this seat; only a new code brings this app back. */
  | 'removed'

export type RadarWsUpdate =
  | { kind: 'status'; connected: boolean; failure?: RadarConnectionFailure }
  | { kind: 'state'; data: unknown }
  | { kind: 'event'; data: unknown; latencyMs: number | null }
