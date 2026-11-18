import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/apiClient'
import type { Invitation, RegisterRequest } from '@/types/api'
import { authKeys, fetchMe } from './authApi'

interface AcceptInvitationRequest {
  userId: string
  token: string
  password: string
  acceptPrivacy: boolean
}

const AFTER_CONFIRM_KEY = 'bookly.after-confirm'

/** Where to continue after confirming the email (e.g. the booking in progress). Best effort only. */
export const afterConfirm = {
  save(path: string) {
    try {
      localStorage.setItem(AFTER_CONFIRM_KEY, path)
    } catch {
      // storage unavailable: the user simply lands on the home page
    }
  },
  take(): string | null {
    try {
      const value = localStorage.getItem(AFTER_CONFIRM_KEY)
      localStorage.removeItem(AFTER_CONFIRM_KEY)
      return value
    } catch {
      return null
    }
  },
}

export function useRegister() {
  return useMutation({
    mutationFn: async (request: RegisterRequest) => {
      await apiClient.post('/auth/register', request)
    },
  })
}

export function useConfirmEmail() {
  return useMutation({
    mutationFn: async (request: { userId: string; token: string }) => {
      await apiClient.post('/auth/confirm-email', request)
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      await apiClient.post('/auth/forgot-password', { email })
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (request: { email: string; token: string; newPassword: string }) => {
      await apiClient.post('/auth/reset-password', request)
    },
  })
}

export const invitationKeys = {
  invitation: (userId: string, token: string) => ['auth', 'invitation', userId, token] as const,
}

/** Who an invitation link is for; a 400 means invalid, expired or already used. */
export function useInvitation(userId: string, token: string) {
  return useQuery({
    queryKey: invitationKeys.invitation(userId, token),
    queryFn: async () =>
      (await apiClient.get<Invitation>('/auth/invitation', { params: { userId, token } })).data,
    enabled: userId !== '' && token !== '',
    retry: false,
    staleTime: Infinity,
  })
}

/** Sets the first password; the API signs the user in, so the session is reloaded like after login. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (request: AcceptInvitationRequest) => {
      await apiClient.post('/auth/accept-invitation', request)
    },
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== authKeys.me[0] })
      await queryClient.fetchQuery({ queryKey: authKeys.me, queryFn: fetchMe, staleTime: 0 })
    },
  })
}
