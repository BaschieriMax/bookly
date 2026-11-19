import { Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate } from 'react-router'
import { Sidebar } from '@/components/navigation/Sidebar'
import type { NavigationArea } from '@/components/navigation/navigationApi'
import { AreaLinks } from '@/features/auth/AreaLinks'
import { useLogout } from '@/features/auth/useMe'

interface ShellLayoutProps {
  area: NavigationArea
  sidebarHeader?: ReactNode
  /** Area-specific links above the links to the user's other areas. */
  sidebarFooter?: ReactNode
}

/** Sidebar + content shell for the admin and platform areas. On small screens the sidebar is a drawer. */
export function ShellLayout({ area, sidebarHeader, sidebarFooter }: ShellLayoutProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => void navigate('/login', { replace: true }) })
  }

  const sidebar = (
    <Sidebar
      area={area}
      header={sidebarHeader}
      footer={
        <>
          {sidebarFooter}
          <AreaLinks current={area} variant="sidebar" onNavigate={() => setMenuOpen(false)} />
        </>
      }
      onNavigate={() => setMenuOpen(false)}
      onLogout={handleLogout}
    />
  )

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-surface md:block">
        {sidebar}
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('menu')}
        >
          <button
            type="button"
            aria-label={t('closeMenu')}
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-72 max-w-[85%] bg-surface">
            <button
              type="button"
              aria-label={t('closeMenu')}
              onClick={() => setMenuOpen(false)}
              className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-control text-muted hover:bg-subtle"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2 md:hidden">
          <button
            type="button"
            aria-label={t('openMenu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="flex size-11 items-center justify-center rounded-control hover:bg-subtle"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <span className="font-heading text-lg font-bold tracking-tight">bookly</span>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
