import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { paths } from '@/app/paths'
import { BooklyLogo } from '@/components/layout/BooklyLogo'
import { LegalFooter } from '@/components/layout/LegalFooter'
import { AreaLinks } from '@/features/auth/AreaLinks'
import { AreaMenu } from '@/features/auth/AreaMenu'
import { useLogout, useMe } from '@/features/auth/useMe'
import { userAreas } from '@/features/auth/userAreas'

/** Customer area: global account, Bookly neutral brand (DEC-016). */
export default function AccountLayout() {
  const { t } = useTranslation(['common', 'account'])
  const logout = useLogout()
  const navigate = useNavigate()
  const { data: me } = useMe()
  // Owners, staff and the platform admin also reach other areas from here.
  const hasOtherAreas = !!me && userAreas(me).some((link) => link.area !== 'account')
  const logOut = () =>
    logout.mutate(undefined, { onSettled: () => void navigate('/', { replace: true }) })

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2 sm:px-6">
        <BooklyLogo />
        <div className="flex items-center gap-1">
          {hasOtherAreas && (
            <>
              {/* Small screens: one "Menu" button, so the header stays on one row. */}
              <AreaMenu current="account" onLogout={logOut} className="sm:hidden" />
              <div className="hidden items-center gap-1 sm:flex">
                <AreaLinks current="account" variant="inline" />
              </div>
            </>
          )}
          <button
            type="button"
            onClick={logOut}
            className={`${hasOtherAreas ? 'hidden sm:flex' : 'flex'} min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-muted hover:bg-subtle`}
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
