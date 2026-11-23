import type { TFunction } from 'i18next'
import { isApiError } from '@/services/apiClient'

const known = [
  'platform.slug_taken',
  'platform.invalid_slug',
  'platform.already_owner',
  'platform.cancel_requires_suspension',
  'booking.concurrent_update',
  'admin.invalid_time_zone',
  'tenant.not_found',
] as const

export function platformErrorMessage(t: TFunction<['platform', 'common']>, error: unknown): string {
  if (isApiError(error)) {
    const code = known.find((c) => c === error.code)
    if (code) return t(`platform:errors.${code}`)
    if (error.status === 403) return t('common:errors.forbidden')
    if (error.status === 0) return t('common:errors.network')
  }
  return t('common:errors.generic')
}
