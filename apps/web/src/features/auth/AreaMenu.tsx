import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AreaLinks } from './AreaLinks'
import type { UserArea } from './userAreas'

interface AreaMenuProps {
  /** Area the user is in: it is not listed. */
  current?: UserArea
  onLogout: () => void
  className?: string
}

/**
 * Compact header menu for small screens: the other areas and "Esci" in a disclosure panel,
 * so the header stays on one row (the inline links wrapped onto three rows at 320 px).
 * Disclosure pattern (button + aria-expanded), not role="menu": the items are plain links.
 */
export function AreaMenu({ current, onLogout, className = '' }: AreaMenuProps) {
  const { t } = useTranslation(['common', 'nav'])
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-semibold text-ink hover:bg-subtle"
      >
        {open ? (
          <X aria-hidden="true" className="size-5" />
        ) : (
          <Menu aria-hidden="true" className="size-5" />
        )}
        {t('nav:menu')}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-2 w-64 rounded-card border border-border bg-surface p-2 shadow-lg"
      >
        <nav aria-label={t('nav:otherAreas')} className="flex flex-col gap-1">
          <AreaLinks current={current} variant="sidebar" onNavigate={close} />
        </nav>
        <div className="mt-1 border-t border-border pt-1">
          <button
            type="button"
            onClick={() => {
              close()
              onLogout()
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-sm font-medium text-muted hover:bg-subtle"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {t('common:logout')}
          </button>
        </div>
      </div>
    </div>
  )
}
