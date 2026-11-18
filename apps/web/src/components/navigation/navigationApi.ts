import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/apiClient'
import { useActiveTenantStore } from '@/stores/activeTenantStore'
import type { NavigationItem } from '@/types/api'

export type NavigationArea = 'admin' | 'platform'

export const navigationKeys = {
  area: (area: NavigationArea, tenantId: string | null) => ['navigation', area, tenantId] as const,
}

async function fetchNavigation(area: NavigationArea): Promise<NavigationItem[]> {
  const response = await apiClient.get<NavigationItem[]>(`/navigation/${area}`)
  return response.data
}

/** Sidebar items served by the API for the current user (DEC-019). */
export function useNavigation(area: NavigationArea) {
  const tenantId = useActiveTenantStore((s) => s.tenantId)
  return useQuery({
    queryKey: navigationKeys.area(area, area === 'admin' ? tenantId : null),
    queryFn: () => fetchNavigation(area),
    enabled: area === 'platform' || tenantId !== null,
  })
}
