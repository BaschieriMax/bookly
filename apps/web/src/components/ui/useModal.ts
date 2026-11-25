import { useEffect, useRef, type RefObject } from 'react'

const FIRST_FIELD = 'input:not([type=hidden]), select, textarea, button:not([data-dialog-close])'

/**
 * Shared behaviour of modal surfaces (Dialog, Sheet): Escape closes, focus moves inside on open
 * and returns to the trigger on close. `initialFocus` "first-field" focuses the first field or
 * button (forms); "none" leaves it to the caller, e.g. a heading with tabIndex -1.
 */
export function useModal(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocus: 'first-field' | 'none' = 'first-field',
) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    if (initialFocus === 'first-field') {
      panelRef.current?.querySelector<HTMLElement>(FIRST_FIELD)?.focus()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open, panelRef, initialFocus])
}
