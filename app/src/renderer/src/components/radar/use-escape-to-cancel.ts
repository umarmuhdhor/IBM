import { useEffect, useRef, type RefObject } from 'react'

// Why: the Sheet closes on Escape from a document capture listener; this window one runs first and keeps it open.
// Only Escape from inside the confirmation counts, so other dialogs still get theirs.
export function useEscapeToCancel(
  section: RefObject<HTMLElement | null>,
  active: boolean,
  cancel: () => void
): void {
  const latest = useRef(cancel)
  latest.current = cancel
  useEffect(() => {
    if (!active) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const inside = event.target instanceof Node && section.current?.contains(event.target)
      if (event.key !== 'Escape' || event.defaultPrevented || !inside) {
        return
      }
      event.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active, section])
}

/** The confirmation is an alert dialog named by its `<id>-title` heading and described by its `<id>-warning` text. */
export function confirmDialogProps(id: string) {
  return {
    role: 'alertdialog',
    'aria-labelledby': `${id}-title`,
    'aria-describedby': `${id}-warning`
  }
}
