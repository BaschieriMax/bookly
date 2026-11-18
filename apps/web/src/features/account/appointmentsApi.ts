import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/apiClient'
import type { MyAppointment } from '@/types/api'

export type AppointmentScope = 'upcoming' | 'past'

export const appointmentKeys = {
  mine: (scope: AppointmentScope) => ['me', 'appointments', scope] as const,
}

export function useMyAppointments(scope: AppointmentScope) {
  return useQuery({
    queryKey: appointmentKeys.mine(scope),
    queryFn: async () =>
      (await apiClient.get<MyAppointment[]>('/me/appointments', { params: { scope } })).data,
    staleTime: 0,
  })
}

export function useCancelAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<MyAppointment>(`/me/appointments/${id}/cancel`)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['me', 'appointments'] }),
  })
}
