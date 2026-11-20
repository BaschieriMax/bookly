import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  closeLabel: string
  children: ReactNode
  /** Buttons row, usually Cancel + primary action. */
  footer?: ReactNode
  /** "wide" for two-column forms on desktop (still a bottom sheet on phones). */
  size?: 'default' | 'wide'
  /** Shown next to the title, e.g. a badge. */
  titleAddon?: ReactNode
  /** Fixed between the header and the scrolling content, e.g. tabs. */
  toolbar?: ReactNode
  /** Same height whatever the content (tabs with lists of different length): the content scrolls. */
  fixedHeight?: boolean
  onClose: () => void
}

/**
 * Accessible modal: focus moves to the first field, Escape and the backdrop close it,
 * focus returns to the trigger. On mobile it opens as a bottom sheet.
 */
export function Dialog({
  open,
  title,
  closeLabel,
  children,
  footer,
  size = 'default',
  titleAddon,
  toolbar,
  fixedHeight = false,
  onClose,
}: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]), select, textarea, button:not([data-dialog-close])',
    )
    first?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-card bg-surface sm:rounded-card ${size === 'wide' ? 'max-w-3xl' : 'max-w-lg'} ${fixedHeight ? 'h-[92vh] sm:h-[min(46rem,92vh)]' : ''}`}
      >
        <div
          className={`flex items-center justify-between gap-4 px-6 ${toolbar ? 'pt-4 pb-2' : 'border-b border-border py-4'}`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={titleId} className="font-heading text-xl font-semibold">
              {title}
            </h2>
            {titleAddon}
          </div>
          <button
            type="button"
            data-dialog-close
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex size-11 items-center justify-center rounded-control text-muted hover:bg-subtle"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {toolbar}
        <div
          className={`flex flex-col gap-4 overflow-y-auto px-6 py-5 ${fixedHeight ? 'min-h-0 flex-1' : ''}`}
        >
          {children}
        </div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
