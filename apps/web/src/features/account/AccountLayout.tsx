import { CalendarCheck, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useNavigate } from 'react-router'
import { useLogout } from '@/features/auth/useMe'

/** Customer area: global account, Bookly neutral brand (DEC-016). */
export default function AccountLayout() {
  const { t } = useTranslation()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 sm:px-6">
        <Link to="/" className="flex min-h-11 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-control bg-primary text-primary-fg"
          >
            <CalendarCheck className="size-4" />
          </span>
          <span className="font-heading text-xl font-bold tracking-tight">bookly</span>
        </Link>
        <button
          type="button"
          onClick={() =>
            logout.mutate(undefined, { onSettled: () => void navigate('/', { replace: true }) })
          }
          className="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-muted hover:bg-subtle"
        >
          <LogOut aria-hidden="true" className="size-4" />
          {t('logout')}
        </button>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
