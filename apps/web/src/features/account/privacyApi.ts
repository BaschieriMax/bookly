import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authKeys, fetchMe } from '@/features/auth/authApi'
import { apiClient } from '@/services/apiClient'
import type { Profile, UpdateProfileRequest } from '@/types/api'

export const profileKeys = { profile: ['me', 'profile'] as const }

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.profile,
    queryFn: async () => (await apiClient.get<Profile>('/me/profile')).data,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateProfileRequest) =>
      (await apiClient.put<Profile>('/me/profile', body)).data,
    onSuccess: async (profile) => {
      queryClient.setQueryData(profileKeys.profile, profile)
      await queryClient.invalidateQueries({ queryKey: authKeys.me })
    },
  })
}

/** Downloads the JSON export through a temporary object URL (the API sets the file name). */
export function useDownloadExport() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.get<Blob>('/me/export', { responseType: 'blob' })
      const disposition = String(response.headers['content-disposition'] ?? '')
      const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'bookly-dati.json'
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
  })
}

/** Deletes the account; the API signs out, so every cached query is dropped and the session reloaded. */
export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (password: string) => {
      await apiClient.post('/me/delete', { password })
    },
    onSuccess: async () => {
      queryClient.clear()
      await queryClient.fetchQuery({ queryKey: authKeys.me, queryFn: fetchMe, staleTime: 0 })
    },
  })
}
