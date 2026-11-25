import { useRef, type ReactNode } from 'react'
import { useModal } from './useModal'

interface SheetProps {
  /** id of the heading that names the sheet (it can change with the step shown). */
  labelledBy: string
  children: ReactNode
  onClose: () => void
}

/**
 * Modal surface for details with actions (DEC-044): a bottom sheet with a drag handle on phones,
 * a full-height panel on the right from 768 px, so the calendar stays in view next to it.
 * Escape and the backdrop close it; the caller lays out header, scrolling body and footer
 * (SheetBody, SheetFooter) and moves focus to its heading.
 */
export function Sheet({ labelledBy, children, onClose }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModal(true, panelRef, onClose, 'none')

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-ink/50 md:bg-ink/20"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // dvh: on iPhone the Safari bar would cover the bottom of a 92vh sheet.
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] animate-sheet-up flex-col rounded-t-[1.25rem] bg-surface shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[28rem] md:animate-slide-in md:rounded-none md:border-l md:border-border"
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-pill bg-border md:hidden"
        />
        {children}
      </div>
    </div>
  )
}

/** Scrolling content of a Sheet. */
export function SheetBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-2 pb-6 md:px-7">
      {children}
    </div>
  )
}

/** Actions pinned to the bottom of a Sheet, above the iPhone home indicator. */
export function SheetFooter({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`shrink-0 border-t border-border px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-7 md:pb-4 ${className}`}
    >
      {children}
    </div>
  )
}
