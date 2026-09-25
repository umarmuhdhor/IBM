import { useEffect, useState } from 'react'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import { useRadarStore } from '@/store/radar-store'

export function useRadarSession() {
  const [connection, setConnection] = useState<RadarConnectionSummary | null>(null)

  useEffect(() => {
    let active = true
    void window.api.radar.getConnection().then((value) => {
      if (active) {
        setConnection(value)
      }
      if (active && value) {
        void window.api.radar.refresh().catch(() => {
          useRadarStore.getState().actions.clear()
        })
      }
    }).catch(() => {
      useRadarStore.getState().actions.clear()
    })
    const unsubscribe = window.api.radar.onUpdate(useRadarStore.getState().actions.receive)
    const stopTicker = useRadarStore.getState().actions.startTicker()
    return () => {
      active = false
      unsubscribe()
      stopTicker()
    }
  }, [])

  return { connection, setConnection }
}
