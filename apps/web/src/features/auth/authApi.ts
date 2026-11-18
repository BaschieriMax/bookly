import { apiClient } from '@/services/apiClient'
import type { LoginRequest, MeResponse } from '@/types/api'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

/** Current user, or null when anonymous (204). Also refreshes the XSRF-TOKEN cookie. */
export async function fetchMe(): Promise<MeResponse | null> {
  const response = await apiClient.get<MeResponse | ''>('/auth/me')
  return response.status === 204 || !response.data ? null : response.data
}

export async function login(request: LoginRequest): Promise<void> {
  await apiClient.post('/auth/login', request)
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}
