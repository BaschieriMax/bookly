import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { paths } from '@/app/paths'
import { BooklyLogo } from '@/components/layout/BooklyLogo'
import { LegalFooter } from '@/components/layout/LegalFooter'
import { AreaLinks } from '@/features/auth/AreaLinks'
import { useLogout } from '@/features/auth/useMe'

/** Customer area: global account, Bookly neutral brand (DEC-016). */
export default function AccountLayout() {
  const { t } = useTranslation(['common', 'account'])
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 sm:px-6">
        <BooklyLogo />
        <div className="flex flex-wrap items-center justify-end gap-1">
          <AreaLinks current="account" variant="inline" />
          <button
            type="button"
            onClick={() =>
              logout.mutate(undefined, { onSettled: () => void navigate('/', { replace: true }) })
            }
            className="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-muted hover:bg-subtle"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {t('common:logout')}
          </button>
        </div>
      </header>
      <nav
        aria-label={t('account:tabs.label')}
        className="mx-auto flex w-full max-w-2xl gap-1 px-4 pt-4 sm:px-6"
      >
        {[
          { to: paths.myAppointments, label: t('account:tabs.appointments') },
          { to: paths.myProfile, label: t('account:tabs.profile') },
        ].map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className="flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-muted hover:bg-subtle aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-text"
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <LegalFooter />
    </div>
  )
}
