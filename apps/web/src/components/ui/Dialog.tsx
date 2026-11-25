import { X } from 'lucide-react'
import { useId, useRef, type ReactNode } from 'react'
import { useModal } from './useModal'

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
  useModal(open, panelRef, onClose)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-ink/50"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // dvh: on iPhone the Safari bar would cover the bottom of a 92vh sheet.
        className={`relative flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-card bg-surface sm:animate-fade-in sm:rounded-card ${size === 'wide' ? 'max-w-3xl' : 'max-w-lg'} ${fixedHeight ? 'h-[92dvh] sm:h-[min(46rem,92dvh)]' : ''}`}
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
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-subtle hover:text-ink"
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
          // Phones: Annulla and the action side by side (1/3, 2/3) instead of two stacked rows;
          // a lone button takes the whole row (DEC-041).
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 border-t border-border px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] *:only:col-span-2 sm:flex sm:justify-end sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
