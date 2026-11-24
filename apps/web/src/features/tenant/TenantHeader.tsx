import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMe } from '@/features/auth/useMe'
import type { PublicTenant } from '@/types/api'
import { loginPath, paths, tenantPath } from '@/app/paths'

export function TenantLogo({ tenant, size = 'md' }: { tenant: PublicTenant; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-10' : 'size-13'
  if (tenant.brand.hasLogo) {
    return (
      <img
        src={`/api/public/tenants/${encodeURIComponent(tenant.slug)}/logo`}
        alt=""
        className={`${box} shrink-0 rounded-pill border border-border-strong object-cover`}
      />
    )
  }
  const initials = tenant.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-pill border border-border-strong bg-surface text-sm font-semibold text-muted`}
    >
      {initials}
    </span>
  )
}

interface TenantHeaderProps {
  tenant: PublicTenant
  backTo?: string
  subtitle?: ReactNode
}

/** Header of the public tenant pages: logo + name, and the account entry point. */
export function TenantHeader({ tenant, backTo, subtitle }: TenantHeaderProps) {
  const { t } = useTranslation('booking')
  const { data: me } = useMe()

  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
      {backTo && (
        <Link
          to={backTo}
          aria-label={t('back')}
          className="-ml-2 flex size-11 items-center justify-center rounded-control transition-colors hover:bg-subtle"
        >
          <ChevronLeft aria-hidden="true" className="size-6" />
        </Link>
      )}
      {!backTo && <TenantLogo tenant={tenant} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to={tenantPath(tenant.slug)}
          className="truncate font-tenant-heading text-2xl leading-tight underline-offset-4 hover:underline"
        >
          {tenant.name}
        </Link>
        {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
      </div>
      {!backTo && (
        <Link
          to={me ? paths.myAppointments : loginPath(tenantPath(tenant.slug))}
          className="flex min-h-11 items-center rounded-control px-2 text-[15px] font-semibold transition-colors hover:bg-subtle"
        >
          {me ? t('myBookings') : t('login')}
        </Link>
      )}
    </header>
  )
}
