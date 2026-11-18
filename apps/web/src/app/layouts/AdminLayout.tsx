import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NoAccess } from '@/components/ui/NoAccess'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { useMe } from '@/features/auth/useMe'
import { useActiveTenantStore } from '@/stores/activeTenantStore'
import type { Membership } from '@/types/api'
import { ShellLayout } from './ShellLayout'

function TenantSwitcher({
  memberships,
  activeId,
}: {
  memberships: Membership[]
  activeId: string
}) {
  const { t } = useTranslation()
  const setTenantId = useActiveTenantStore((s) => s.setTenantId)
  const active = memberships.find((m) => m.tenantId === activeId)

  if (memberships.length === 1) {
    return (
      <div className="flex min-h-12 flex-col justify-center rounded-card border border-border bg-bg px-3 leading-tight">
        <span className="text-sm font-semibold">{active?.tenantName}</span>
        <span className="text-xs text-muted">{active?.role}</span>
      </div>
    )
  }

  return (
    <label className="flex flex-col gap-1 px-1 text-xs font-semibold text-muted">
      {t('tenant')}
      <select
        value={activeId}
        onChange={(event) => setTenantId(event.target.value)}
        className="min-h-11 rounded-control border border-border-strong bg-surface px-2 text-sm font-semibold text-ink"
      >
        {memberships.map((m) => (
          <option key={m.tenantId} value={m.tenantId}>
            {m.tenantName} · {m.role}
          </option>
        ))}
      </select>
    </label>
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

  useEffect(() => {
    if (!activeIsValid && firstTenantId) {
      setTenantId(firstTenantId)
    }
  }, [activeIsValid, firstTenantId, setTenantId])

  if (memberships.length === 0) {
    return <NoAccess />
  }

  if (!activeIsValid || !tenantId) {
    return <PageSpinner />
  }

  return (
    <ShellLayout
      area="admin"
      sidebarHeader={<TenantSwitcher memberships={memberships} activeId={tenantId} />}
    />
  )
}
