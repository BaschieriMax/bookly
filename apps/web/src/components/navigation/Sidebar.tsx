import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { paths } from '@/app/paths'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { iconRegistry } from './iconRegistry'
import { useNavigation, type NavigationArea } from './navigationApi'
import { translateLabel, usableItems } from './navigationItems'

interface SidebarProps {
  area: NavigationArea
  header?: ReactNode
  /** Extra links above logout (public page, other areas). */
  footer?: ReactNode
  onNavigate?: () => void
  onLogout: () => void
}

/** Inside the management shells the logo leads to the area's first page, not to the public landing. */
const areaHome: Record<NavigationArea, string> = {
  admin: paths.admin.calendar,
  platform: paths.platform.tenants,
}

export function Sidebar({ area, header, footer, onNavigate, onLogout }: SidebarProps) {
  const { t } = useTranslation(['common', 'nav'])
  const { data, isPending, isError } = useNavigation(area)
  const items = usableItems(data ?? [])

  return (
    <div className="flex h-full flex-col gap-4 px-3 py-5">
      <BrandLogo to={areaHome[area]} className="px-2" onClick={onNavigate} />

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
                    `flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] transition-colors ${
                      isActive
                        ? 'bg-primary-soft font-semibold text-primary-text'
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
        {footer}
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-11 items-center gap-2 rounded-control px-3 text-left text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <LogOut aria-hidden="true" className="size-4" />
          {t('logout')}
        </button>
      </div>
    </div>
  )
}
