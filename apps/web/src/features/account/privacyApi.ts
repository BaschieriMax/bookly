import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authKeys, fetchMe } from '@/features/auth/authApi'
import { saveDownloadedFile } from '@/lib/download'
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
      saveDownloadedFile(response, 'turnora-dati.json')
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
