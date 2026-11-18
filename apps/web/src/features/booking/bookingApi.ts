import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/apiClient'
import type { CreateAppointmentRequest, MyAppointment } from '@/types/api'

export function useCreateAppointment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (request: CreateAppointmentRequest) =>
      (
        await apiClient.post<MyAppointment>(
          `/tenants/${encodeURIComponent(slug)}/appointments`,
          request,
        )
      ).data,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant', slug, 'slots'] }),
        queryClient.invalidateQueries({ queryKey: ['tenant', slug, 'days'] }),
        queryClient.invalidateQueries({ queryKey: ['me', 'appointments'] }),
      ]),
  })
}

export function useResendConfirmation() {
  return useMutation({
    mutationFn: async (email: string) => {
      await apiClient.post('/auth/resend-confirmation', { email })
    },
  })
}
