import type { RadarState } from '@radar/ui'
import { create } from 'zustand'
import type { RadarConnectionFailure, RadarWsUpdate } from '../../../shared/radar-update'
import { applyRadarEvent, normalizeRadarState } from '../lib/radar/state-adapter'

type RadarStore = {
  state: RadarState | null
  connected: boolean
  connectionFailure: RadarConnectionFailure | null
  now: number
  latencyMs: number | null
  actions: {
    receive: (update: RadarWsUpdate) => void
    clear: () => void
    startTicker: () => () => void
  }
}

export const useRadarStore = create<RadarStore>()((set) => ({
  state: null,
  connected: false,
  connectionFailure: null,
  now: Date.now(),
  latencyMs: null,
  actions: {
    receive: (update) => {
      if (update.kind === 'status') {
        set({ connected: update.connected, connectionFailure: update.connected ? null : update.failure ?? null })
      } else if (update.kind === 'state') {
        const state = normalizeRadarState(update.data)
        if (state) {
          set({ state })
        }
      } else {
        set((current) => ({
          state: current.state ? applyRadarEvent(current.state, update.data) : null,
          latencyMs: update.latencyMs
        }))
      }
    },
    clear: () => set({ state: null, connected: false, connectionFailure: null, latencyMs: null }),
    startTicker: () => {
      const timer = setInterval(() => set({ now: Date.now() }), 250)
      return () => clearInterval(timer)
    }
  }
}))
