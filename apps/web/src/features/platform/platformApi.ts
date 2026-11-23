import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authKeys } from '@/features/auth/authApi'
import { tenantKeys } from '@/features/tenant/tenantApi'
import { apiClient } from '@/services/apiClient'
import type {
  CreateTenantRequest,
  InviteOwnerRequest,
  NavigationAdminItem,
  PlatformTenant,
} from '@/types/api'

export const platformKeys = {
  tenants: ['platform', 'tenants'] as const,
  navigation: ['platform', 'navigation'] as const,
}

export function usePlatformTenants() {
  return useQuery({
    queryKey: platformKeys.tenants,
    queryFn: async () => (await apiClient.get<PlatformTenant[]>('/platform/tenants')).data,
  })
}

/**
 * Every tenant change refreshes, besides the list:
 * - /auth/me, because a super-admin can also be a member of the tenant (or invite their own
 *   email): the shell's areas and the admin area are built from those memberships;
 * - the tenant's public page, so a suspended tenant is not served from the cache.
 */
function useTenantMutation<TInput>(request: (input: TInput) => Promise<PlatformTenant>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSettled: (tenant) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: platformKeys.tenants }),
        queryClient.invalidateQueries({ queryKey: authKeys.me }),
        tenant && queryClient.invalidateQueries({ queryKey: tenantKeys.tenant(tenant.slug) }),
      ]),
  })
}

export const useCreateTenant = () =>
  useTenantMutation(
    async (body: CreateTenantRequest) =>
      (await apiClient.post<PlatformTenant>('/platform/tenants', body)).data,
  )

export const useSetTenantStatus = () =>
  useTenantMutation(
    async ({ id, status }: { id: string; status: 'Active' | 'Suspended' }) =>
      (await apiClient.put<PlatformTenant>(`/platform/tenants/${id}/status`, { status })).data,
  )

export const useInviteOwner = () =>
  useTenantMutation(
    async ({ id, body }: { id: string; body: InviteOwnerRequest }) =>
      (await apiClient.post<PlatformTenant>(`/platform/tenants/${id}/owners`, body)).data,
  )

export function useNavigationAdmin() {
  return useQuery({
    queryKey: platformKeys.navigation,
    queryFn: async () => (await apiClient.get<NavigationAdminItem[]>('/platform/navigation')).data,
  })
}

/** Changes the server-driven sidebar (DEC-019): every user's menu is refreshed. */
export function useUpdateNavigationItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; isEnabled?: boolean; sortOrder?: number }) =>
      (
        await apiClient.patch<NavigationAdminItem>(`/platform/navigation/${id}`, {
          isEnabled: body.isEnabled ?? null,
          sortOrder: body.sortOrder ?? null,
        })
      ).data,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: platformKeys.navigation })
      await queryClient.invalidateQueries({ queryKey: ['navigation'] })
    },
  })
}
