import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { paths } from '@/app/paths'
import { BooklyLogo } from '@/components/layout/BooklyLogo'
import { AreaLinks } from '@/features/auth/AreaLinks'
import { useLogout, useMe } from '@/features/auth/useMe'
import { homePathFor } from '@/features/auth/userAreas'

const linkClass =
  'flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-ink transition-colors hover:bg-subtle'
const primaryClass =
  'flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover'

/** Header of the public pages: login and sign-up, or the user's areas once signed in. */
export function PublicHeader() {
  const { t } = useTranslation(['common', 'nav'])
  const { data: me, isPending } = useMe()
  const logout = useLogout()
  const { pathname } = useLocation()

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <BooklyLogo />
        {!isPending && (
          <nav aria-label={t('nav:siteMenu')} className="flex items-center gap-1">
            {me ? (
              <>
                {/* Small screens: one way in (the other areas are linked from inside it). */}
                <Link to={homePathFor(me)} className={`${primaryClass} sm:hidden`}>
                  {t('nav:yourArea')}
                </Link>
                <div className="hidden items-center gap-1 sm:flex">
                  <AreaLinks variant="inline" />
                </div>
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  className="flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink sm:px-3"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  {t('logout')}
                </button>
              </>
            ) : (
              <>
                {pathname !== paths.login && (
                  <Link to={paths.login} className={linkClass}>
                    {t('login')}
                  </Link>
                )}
                {pathname !== paths.register && (
                  <Link to={paths.register} className={primaryClass}>
                    {t('register')}
                  </Link>
                )}
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
