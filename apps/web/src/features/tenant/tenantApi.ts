import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/apiClient'
import type { PublicAvailability, PublicDays, PublicService, PublicTenant } from '@/types/api'

export const tenantKeys = {
  tenant: (slug: string) => ['tenant', slug] as const,
  services: (slug: string) => ['tenant', slug, 'services'] as const,
  days: (slug: string, serviceId: string, staffId: string | null, from: string, to: string) =>
    ['tenant', slug, 'days', serviceId, staffId, from, to] as const,
  slots: (slug: string, serviceId: string, staffId: string | null, date: string) =>
    ['tenant', slug, 'slots', serviceId, staffId, date] as const,
}

const base = (slug: string) => `/public/tenants/${encodeURIComponent(slug)}`

/** Home-screen icon and manifest of a business (DEC-043): full paths, for <link> tags. */
export const tenantIconUrl = (slug: string) => `/api${base(slug)}/icon`
export const tenantManifestUrl = (slug: string) => `/api${base(slug)}/manifest.webmanifest`

export function useTenant(slug: string) {
  return useQuery({
    queryKey: tenantKeys.tenant(slug),
    queryFn: async () => (await apiClient.get<PublicTenant>(base(slug))).data,
  })
}

export function useServices(slug: string) {
  return useQuery({
    queryKey: tenantKeys.services(slug),
    queryFn: async () => (await apiClient.get<PublicService[]>(`${base(slug)}/services`)).data,
  })
}

/** Days with free slots, for the date picker. Availability is volatile: always fresh. */
export function useAvailableDays(
  slug: string,
  serviceId: string,
  staffId: string | null,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: tenantKeys.days(slug, serviceId, staffId, from, to),
    queryFn: async () =>
      (
        await apiClient.get<PublicDays>(`${base(slug)}/availability/days`, {
          params: { serviceId, staffId: staffId ?? undefined, from, to },
        })
      ).data,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}

export function useSlots(
  slug: string,
  serviceId: string,
  staffId: string | null,
  date: string | null,
) {
  return useQuery({
    queryKey: tenantKeys.slots(slug, serviceId, staffId, date ?? ''),
    queryFn: async () =>
      (
        await apiClient.get<PublicAvailability>(`${base(slug)}/availability`, {
          params: { serviceId, staffId: staffId ?? undefined, date },
        })
      ).data,
    enabled: date !== null,
    staleTime: 0,
  })
}
