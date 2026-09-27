import { useEffect, useRef } from 'react'

// Why: the Sheet closes on Escape from a document capture listener; this window one runs first and keeps it open.
export function useEscapeToCancel(active: boolean, cancel: () => void): void {
  const latest = useRef(cancel)
  latest.current = cancel
  useEffect(() => {
    if (!active) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return
      }
      event.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active])
}
