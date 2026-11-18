import type { TFunction } from 'i18next'
import { isApiError } from '@/services/apiClient'

const knownCodes = [
  'admin.not_found',
  'admin.in_use',
  'admin.overlapping_hours',
  'admin.invalid_time_zone',
  'admin.invalid_logo',
  'admin.staff_scope',
  'admin.staff_unavailable',
  'admin.service_not_offered',
  'admin.invalid_status',
  'admin.not_started',
  'admin.in_past',
  'booking.invalid_range',
  'booking.slot_unavailable',
  'booking.concurrent_update',
  'booking.appointment_not_found',
] as const

type KnownCode = (typeof knownCodes)[number]

const isKnown = (code: string | null): code is KnownCode =>
  code !== null && (knownCodes as readonly string[]).includes(code)

/** Translated message for an admin API error: stable code first, then generic fallbacks. */
export function adminErrorMessage(t: TFunction<['admin', 'common']>, error: unknown): string {
  if (isApiError(error)) {
    if (isKnown(error.code)) return t(`admin:errors.${error.code}`)
    if (error.status === 403) return t('admin:errors.forbidden')
    if (error.status === 429) return t('common:errors.tooManyRequests')
    if (error.status === 0) return t('common:errors.network')
  }
  return t('common:errors.generic')
}
