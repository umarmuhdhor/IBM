import { applyEvent, parseRadarEvent, StateRes, stateFromSnapshot } from '@radar/common'
import type { RadarState } from '@radar/common'

export function normalizeRadarState(value: unknown): RadarState | null {
  const result = StateRes.safeParse(value)
  return result.success ? stateFromSnapshot(result.data) : null
}

export function applyRadarEvent(state: RadarState, value: unknown): RadarState {
  const event = parseRadarEvent(value)
  return event ? applyEvent(state, event) : state
}
