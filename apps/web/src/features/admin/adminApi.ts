import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authKeys } from '@/features/auth/authApi'
import { apiClient } from '@/services/apiClient'
import { useActiveTenantStore } from '@/stores/activeTenantStore'
import type {
  AdminService,
  AdminStaff,
  CreatedTimeOff,
  CreateTimeOffRequest,
  SaveServiceRequest,
  SaveStaffRequest,
  SaveTenantBrandRequest,
  SaveTenantSettingsRequest,
  TenantBrandSettings,
  TenantSettings,
  TimeOff,
  WorkingInterval,
} from '@/types/api'

/**
 * Query keys of the admin area always include the active tenant: switching tenant
 * never shows (or invalidates) another tenant's cached data.
 */
export const adminKeys = {
  all: (tenantId: string | null) => ['admin', tenantId] as const,
  services: (tenantId: string | null) => ['admin', tenantId, 'services'] as const,
  staff: (tenantId: string | null) => ['admin', tenantId, 'staff'] as const,
  hours: (tenantId: string | null, staffId: string) =>
    ['admin', tenantId, 'staff', staffId, 'hours'] as const,
  timeOff: (tenantId: string | null, staffId: string) =>
    ['admin', tenantId, 'staff', staffId, 'time-off'] as const,
  settings: (tenantId: string | null) => ['admin', tenantId, 'settings'] as const,
  brand: (tenantId: string | null) => ['admin', tenantId, 'brand'] as const,
}

const useTenantId = () => useActiveTenantStore((s) => s.tenantId)

// ---- Services --------------------------------------------------------------------------------

export function useAdminServices() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: adminKeys.services(tenantId),
    queryFn: async () => (await apiClient.get<AdminService[]>('/admin/services')).data,
    enabled: tenantId !== null,
  })
}

export function useSaveService() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string | null; body: SaveServiceRequest }) =>
      id
        ? (await apiClient.put<AdminService>(`/admin/services/${id}`, body)).data
        : (await apiClient.post<AdminService>('/admin/services', body)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.all(tenantId) }),
  })
}

export function useDeleteService() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/services/${id}`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.all(tenantId) }),
  })
}

// ---- Staff -----------------------------------------------------------------------------------

export function useAdminStaff() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: adminKeys.staff(tenantId),
    queryFn: async () => (await apiClient.get<AdminStaff[]>('/admin/staff')).data,
    enabled: tenantId !== null,
  })
}

export function useSaveStaff() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string | null; body: SaveStaffRequest }) =>
      id
        ? (await apiClient.put<AdminStaff>(`/admin/staff/${id}`, body)).data
        : (await apiClient.post<AdminStaff>('/admin/staff', body)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.all(tenantId) }),
  })
}

export function useDeleteStaff() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/staff/${id}`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.all(tenantId) }),
  })
}

// ---- Schedule --------------------------------------------------------------------------------

export function useWorkingHours(staffId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: adminKeys.hours(tenantId, staffId ?? ''),
    queryFn: async () =>
      (await apiClient.get<WorkingInterval[]>(`/admin/staff/${staffId}/working-hours`)).data,
    enabled: tenantId !== null && staffId !== null,
  })
}

export function useSaveWorkingHours(staffId: string) {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (intervals: WorkingInterval[]) =>
      (
        await apiClient.put<WorkingInterval[]>(`/admin/staff/${staffId}/working-hours`, {
          intervals,
        })
      ).data,
    onSuccess: (data) => queryClient.setQueryData(adminKeys.hours(tenantId, staffId), data),
  })
}

export function useTimeOff(staffId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: adminKeys.timeOff(tenantId, staffId ?? ''),
    queryFn: async () => (await apiClient.get<TimeOff[]>(`/admin/staff/${staffId}/time-off`)).data,
    enabled: tenantId !== null && staffId !== null,
  })
}

export function useAddTimeOff(staffId: string) {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateTimeOffRequest) =>
      (await apiClient.post<CreatedTimeOff>(`/admin/staff/${staffId}/time-off`, body)).data,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.timeOff(tenantId, staffId) }),
  })
}

export function useDeleteTimeOff(staffId: string) {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/staff/${staffId}/time-off/${id}`)
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.timeOff(tenantId, staffId) }),
  })
}

// ---- Settings and brand ----------------------------------------------------------------------

export function useTenantSettings() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: adminKeys.settings(tenantId),
    queryFn: async () => (await apiClient.get<TenantSettings>('/admin/settings')).data,
    enabled: tenantId !== null,
  })
}

export function useSaveTenantSettings() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: SaveTenantSettingsRequest) =>
      (await apiClient.put<TenantSettings>('/admin/settings', body)).data,
    onSuccess: async (data) => {
      queryClient.setQueryData(adminKeys.settings(tenantId), data)
      // The tenant name is also shown by the shell (memberships) and the public page.
      await queryClient.invalidateQueries({ queryKey: authKeys.me })
      await queryClient.invalidateQueries({ queryKey: ['tenant', data.slug] })
    },
  })
}

export function useTenantBrand() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: adminKeys.brand(tenantId),
    queryFn: async () => (await apiClient.get<TenantBrandSettings>('/admin/brand')).data,
    enabled: tenantId !== null,
  })
}

function useBrandMutation<TInput>(request: (input: TInput) => Promise<TenantBrandSettings | null>) {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.brand(tenantId) })
      await queryClient.invalidateQueries({ queryKey: ['tenant'] })
    },
  })
}

export function useSaveTenantBrand() {
  return useBrandMutation(
    async (body: SaveTenantBrandRequest) =>
      (await apiClient.put<TenantBrandSettings>('/admin/brand', body)).data,
  )
}

export function useUploadLogo() {
  return useBrandMutation(async (file: File) => {
    const form = new FormData()
    form.append('logo', file)
    return (await apiClient.put<TenantBrandSettings>('/admin/brand/logo', form)).data
  })
}

export function useDeleteLogo() {
  return useBrandMutation(async () => {
    await apiClient.delete('/admin/brand/logo')
    return null
  })
}
