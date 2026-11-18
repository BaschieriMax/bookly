import { CalendarCheck, ExternalLink, LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router'
import { iconRegistry } from './iconRegistry'
import { useNavigation, type NavigationArea } from './navigationApi'
import { translateLabel, usableItems } from './navigationItems'

interface SidebarProps {
  area: NavigationArea
  header?: ReactNode
  onNavigate?: () => void
  onLogout: () => void
}

export function Sidebar({ area, header, onNavigate, onLogout }: SidebarProps) {
  const { t } = useTranslation(['common', 'nav'])
  const { data, isPending, isError } = useNavigation(area)
  const items = usableItems(data ?? [])

  return (
    <div className="flex h-full flex-col gap-4 px-3 py-5">
      <Link to="/" className="flex items-center gap-2 px-2" onClick={onNavigate}>
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-control bg-primary text-primary-fg"
        >
          <CalendarCheck className="size-4" />
        </span>
        <span className="font-heading text-xl font-bold tracking-tight">bookly</span>
      </Link>

      {header}

      <nav aria-label={t(area === 'admin' ? 'nav:adminMenu' : 'nav:platformMenu')}>
        {isPending && <p className="px-3 text-sm text-muted">{t('loading')}</p>}
        {isError && <p className="px-3 text-sm text-danger">{t('errors.generic')}</p>}
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = iconRegistry[item.icon]!
            return (
              <li key={item.key}>
                <NavLink
                  to={item.route}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] ${
                      isActive
                        ? 'bg-primary-soft font-semibold text-primary'
                        : 'font-medium text-ink hover:bg-subtle'
                    }`
                  }
                >
                  <Icon aria-hidden="true" className="size-[18px]" />
                  {translateLabel(item.labelKey)}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {area === 'admin' && (
          <Link
            to="/"
            onClick={onNavigate}
            className="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-primary hover:bg-subtle"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            {t('nav:publicPage')}
          </Link>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-11 items-center gap-2 rounded-control px-3 text-left text-sm font-medium text-muted hover:bg-subtle"
        >
          <LogOut aria-hidden="true" className="size-4" />
          {t('logout')}
        </button>
      </div>
    </div>
  )
}
