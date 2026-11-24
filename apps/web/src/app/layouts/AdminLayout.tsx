import { ExternalLink } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NoAccess } from '@/components/ui/NoAccess'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { useMe } from '@/features/auth/useMe'
import { homePathFor } from '@/features/auth/userAreas'
import { useActiveTenantStore } from '@/stores/activeTenantStore'
import type { Membership } from '@/types/api'
import { ShellLayout } from './ShellLayout'
import { fieldClass } from '@/components/ui/fieldStyles'
import { tenantPath } from '@/app/paths'
import { NewTabHint } from '@/components/ui/NewTabHint'

function TenantSwitcher({
  memberships,
  activeId,
}: {
  memberships: Membership[]
  activeId: string
}) {
  const { t } = useTranslation()
  const roleLabel = (role: string) => t(`roles.${role}`, { defaultValue: role })
  const setTenantId = useActiveTenantStore((s) => s.setTenantId)
  const active = memberships.find((m) => m.tenantId === activeId)

  if (memberships.length === 1) {
    return (
      <div className="flex min-h-12 flex-col justify-center rounded-card border border-border bg-bg px-3 leading-tight">
        <span className="text-sm font-semibold">{active?.tenantName}</span>
        <span className="text-xs text-muted">{active && roleLabel(active.role)}</span>
      </div>
    )
  }

  return (
    <label className="flex flex-col gap-1 px-1 text-xs font-semibold text-muted">
      {t('tenant')}
      <select
        value={activeId}
        onChange={(event) => setTenantId(event.target.value)}
        className={`min-h-11 px-2 text-sm font-semibold ${fieldClass()}`}
      >
        {memberships.map((m) => (
          <option key={m.tenantId} value={m.tenantId}>
            {m.tenantName} · {roleLabel(m.role)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Public page of the tenant being managed, as its customers see it. */
function PublicPageLink({ slug }: { slug: string }) {
  const { t } = useTranslation(['nav', 'common'])
  // A new tab, as in Settings: the owner keeps the admin area open (the icon says so too).
  return (
    <Link
      to={tenantPath(slug)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-primary-text transition-colors hover:bg-subtle"
    >
      <ExternalLink aria-hidden="true" className="size-4" />
      {t('publicPage')}
      <NewTabHint />
    </Link>
  )
}

/** Admin area of a tenant: requires a membership; the active tenant is chosen among them. */
export function AdminLayout() {
  const { data: me } = useMe()
  const tenantId = useActiveTenantStore((s) => s.tenantId)
  const setTenantId = useActiveTenantStore((s) => s.setTenantId)
  const memberships = me?.memberships ?? []
  const activeIsValid = memberships.some((m) => m.tenantId === tenantId)
  const firstTenantId = memberships[0]?.tenantId
  const activeSlug = memberships.find((m) => m.tenantId === tenantId)?.tenantSlug

  useEffect(() => {
    if (!activeIsValid && firstTenantId) {
      setTenantId(firstTenantId)
    }
  }, [activeIsValid, firstTenantId, setTenantId])

  if (memberships.length === 0) {
    return <NoAccess homePath={homePathFor(me)} />
  }

  if (!activeIsValid || !tenantId) {
    return <PageSpinner />
  }

  return (
    <ShellLayout
      area="admin"
      sidebarHeader={<TenantSwitcher memberships={memberships} activeId={tenantId} />}
      sidebarFooter={activeSlug && <PublicPageLink slug={activeSlug} />}
    />
  )
}
