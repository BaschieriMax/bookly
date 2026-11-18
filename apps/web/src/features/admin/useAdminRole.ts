import { useMe } from '@/features/auth/useMe'
import { useActiveTenantStore } from '@/stores/activeTenantStore'

/** Membership of the active tenant: role and slug (for the public page link and logo). */
export function useActiveMembership() {
  const { data: me } = useMe()
  const tenantId = useActiveTenantStore((s) => s.tenantId)
  const membership = me?.memberships.find((m) => m.tenantId === tenantId) ?? null
  return {
    membership,
    isOwner: membership?.role === 'Owner',
  }
}
