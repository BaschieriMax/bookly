import axios, { AxiosError } from 'axios'
import { useActiveTenantStore } from '@/stores/activeTenantStore'

export const TENANT_HEADER = 'X-Bookly-Tenant'

/**
 * Single HTTP client (same origin, DEC-010). Axios copies the XSRF-TOKEN cookie into the
 * X-XSRF-TOKEN header on same-origin requests, as the API requires (DEC-005).
 */
export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: { Accept: 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const tenantId = useActiveTenantStore.getState().tenantId
  if (tenantId) {
    config.headers.set(TENANT_HEADER, tenantId)
  }
  return config
})

const SAFE_METHODS = new Set(['get', 'head', 'options'])
let xsrfPriming: Promise<unknown> | null = null

const hasXsrfCookie = () => document.cookie.split('; ').some((c) => c.startsWith('XSRF-TOKEN='))

/**
 * Pages opened straight from an email link (confirm email, reset password, invitation) may send
 * a POST before anything called GET /auth/me, which issues the XSRF-TOKEN cookie. Prime it once.
 */
apiClient.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase()
  if (!SAFE_METHODS.has(method) && !hasXsrfCookie()) {
    xsrfPriming ??= axios
      .get('/api/auth/me', { withCredentials: true })
      .catch(() => undefined)
      .finally(() => {
        xsrfPriming = null
      })
    await xsrfPriming
  }
  return config
})

/** Normalised API error: HTTP status, stable error code (translated by the UI) and field errors. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly fieldErrors: Record<string, string[]>

  constructor(
    status: number,
    code: string | null,
    fieldErrors: Record<string, string[]>,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

interface ProblemBody {
  title?: string
  code?: string
  errors?: Record<string, string[]>
}

apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 0
    const body = (error.response?.data ?? {}) as ProblemBody
    return Promise.reject(
      new ApiError(status, body.code ?? null, body.errors ?? {}, body.title ?? error.message),
    )
  }
  return Promise.reject(error instanceof Error ? error : new Error(String(error)))
})

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status)
}
