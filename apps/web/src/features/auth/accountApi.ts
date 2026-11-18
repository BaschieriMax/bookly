import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/services/apiClient'
import type { RegisterRequest } from '@/types/api'

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
