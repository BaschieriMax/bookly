import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest } from '@/types/api'
import { authKeys, fetchMe, login, logout } from './authApi'

export function useMe() {
  return useQuery({ queryKey: authKeys.me, queryFn: fetchMe })
}

/**
 * Logs in, then reloads the session: /auth/me also issues the antiforgery token bound to the new
 * identity. Resolves with the signed-in user, so the caller can pick where to go next.
 */
export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (request: LoginRequest) => {
      await login(request)
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== authKeys.me[0] })
      return queryClient.fetchQuery({ queryKey: authKeys.me, queryFn: fetchMe, staleTime: 0 })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSettled: async () => {
      queryClient.clear()
      await queryClient.fetchQuery({ queryKey: authKeys.me, queryFn: fetchMe, staleTime: 0 })
    },
  })
}
