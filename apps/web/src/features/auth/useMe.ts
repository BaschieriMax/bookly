import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authKeys, fetchMe, login, logout } from './authApi'

export function useMe() {
  return useQuery({ queryKey: authKeys.me, queryFn: fetchMe })
}

/** Logs in, then reloads the session: /auth/me also issues the antiforgery token bound to the new identity. */
export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: login,
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== authKeys.me[0] })
      await queryClient.fetchQuery({ queryKey: authKeys.me, queryFn: fetchMe, staleTime: 0 })
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
