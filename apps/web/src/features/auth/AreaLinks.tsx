import { CalendarDays, ShieldCheck, Store, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMe } from './useMe'
import { userAreas, type UserArea } from './userAreas'

const icons: Record<UserArea, LucideIcon> = {
  platform: ShieldCheck,
  admin: Store,
  account: CalendarDays,
}

const styles = {
  // Full-width rows in the admin/platform sidebar.
  sidebar:
    'flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-ink transition-colors hover:bg-subtle',
  // Header links.
  inline:
    'flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-medium text-ink transition-colors hover:bg-subtle sm:px-3',
} as const

interface AreaLinksProps {
  /** Area the user is in: it is not repeated. */
  current?: UserArea
  variant: keyof typeof styles
  onNavigate?: () => void
}

/** Links to the other areas the signed-in user can open (platform, business admin, own bookings). */
export function AreaLinks({ current, variant, onNavigate }: AreaLinksProps) {
  const { t } = useTranslation('nav')
  const { data: me } = useMe()
  if (!me) {
    return null
  }

  return userAreas(me)
    .filter((link) => link.area !== current)
    .map((link) => {
      const Icon = icons[link.area]
      return (
        <Link key={link.area} to={link.to} onClick={onNavigate} className={styles[variant]}>
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {t(`areas.${link.area}`)}
        </Link>
      )
    })
}
