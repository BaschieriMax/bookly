import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/apiClient'
import { useActiveTenantStore } from '@/stores/activeTenantStore'
import type { AdminAppointment, Calendar, MoveAppointmentRequest } from '@/types/api'

export interface CalendarQuery {
  from: string
  to: string
  staffId: string | null
  includeCancelled: boolean
}

export const calendarKeys = {
  all: (tenantId: string | null) => ['admin', tenantId, 'calendar'] as const,
  range: (tenantId: string | null, query: CalendarQuery) =>
    ['admin', tenantId, 'calendar', query] as const,
}

/** Appointments change from outside (online bookings): always fresh, refreshed every minute. */
export function useCalendar(query: CalendarQuery) {
  const tenantId = useActiveTenantStore((s) => s.tenantId)
  return useQuery({
    queryKey: calendarKeys.range(tenantId, query),
    queryFn: async () =>
      (
        await apiClient.get<Calendar>('/admin/calendar', {
          params: {
            from: query.from,
            to: query.to,
            staffId: query.staffId ?? undefined,
            includeCancelled: query.includeCancelled || undefined,
          },
        })
      ).data,
    enabled: tenantId !== null,
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchInterval: 60_000,
  })
}

function useAppointmentMutation<TInput>(request: (input: TInput) => Promise<AdminAppointment>) {
  const tenantId = useActiveTenantStore((s) => s.tenantId)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    // Refresh also on errors: a 409 means the calendar shown is out of date.
    onSettled: () => queryClient.invalidateQueries({ queryKey: calendarKeys.all(tenantId) }),
  })
}

export const useMoveAppointment = () =>
  useAppointmentMutation(
    async ({ id, body }: { id: string; body: MoveAppointmentRequest }) =>
      (await apiClient.post<AdminAppointment>(`/admin/appointments/${id}/move`, body)).data,
  )

export const useCancelByBusiness = () =>
  useAppointmentMutation(
    async ({ id, reason }: { id: string; reason: string | null }) =>
      (await apiClient.post<AdminAppointment>(`/admin/appointments/${id}/cancel`, { reason })).data,
  )

export const useMarkAppointment = () =>
  useAppointmentMutation(
    async ({ id, outcome }: { id: string; outcome: 'complete' | 'no-show' }) =>
      (await apiClient.post<AdminAppointment>(`/admin/appointments/${id}/${outcome}`)).data,
  )
