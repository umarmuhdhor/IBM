import { useEffect } from 'react'
import { useRadarStore } from '@/store/radar-store'
import { useLiveCollabPageStore } from './live-collab-page-store'

export function useRadarSession(): void {
  useEffect(() => {
    let active = true
    const { setConnection } = useLiveCollabPageStore.getState()
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
}
