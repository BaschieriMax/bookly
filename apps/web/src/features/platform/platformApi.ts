import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authKeys } from '@/features/auth/authApi'
import { tenantKeys } from '@/features/tenant/tenantApi'
import { apiClient } from '@/services/apiClient'
import type {
  CreateTenantRequest,
  FutureAppointments,
  InviteOwnerRequest,
  NavigationAdminItem,
  PlatformTenant,
  SetTenantStatusRequest,
} from '@/types/api'

export const platformKeys = {
  tenants: ['platform', 'tenants'] as const,
  futureAppointments: (id: string) => ['platform', 'tenants', id, 'future-appointments'] as const,
  navigation: ['platform', 'navigation'] as const,
}

/** Emails of a suspension still going out (DEC-039): the list refreshes to show the progress. */
const NOTICES_POLL_MS = 5_000

const isSendingNotices = (tenant: PlatformTenant) =>
  tenant.suspensionNotices?.state === 'Sending' || tenant.suspensionNotices?.state === 'Retrying'

export function usePlatformTenants() {
  return useQuery({
    queryKey: platformKeys.tenants,
    queryFn: async () => (await apiClient.get<PlatformTenant[]>('/platform/tenants')).data,
    refetchInterval: (query) =>
      query.state.data?.some(isSendingNotices) ? NOTICES_POLL_MS : false,
  })
}

/** How many future confirmed appointments the tenant has (the number only). Fresh at every opening. */
export function useFutureAppointments(id: string) {
  return useQuery({
    queryKey: platformKeys.futureAppointments(id),
    queryFn: async () =>
      (await apiClient.get<FutureAppointments>(`/platform/tenants/${id}/future-appointments`)).data
        .count,
    staleTime: 0,
    gcTime: 0,
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

interface SetTenantStatusInput {
  id: string
  status: 'Active' | 'Suspended'
  /** Only when suspending: also cancel the future appointments and notify (DEC-039). */
  cancelFutureAppointments?: boolean
}

export const useSetTenantStatus = () =>
  useTenantMutation(
    async ({ id, status, cancelFutureAppointments = false }: SetTenantStatusInput) =>
      (
        await apiClient.put<PlatformTenant>(`/platform/tenants/${id}/status`, {
          status,
          cancelFutureAppointments,
        } satisfies SetTenantStatusRequest)
      ).data,
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
