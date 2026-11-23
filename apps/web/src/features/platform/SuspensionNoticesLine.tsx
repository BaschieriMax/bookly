import { Clock, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PlatformSuspensionNotices } from '@/types/api'

const stateKeys = {
  Sending: { customers: 'tenants.notices.sending', owners: 'tenants.notices.ownerSending' },
  PausedDailyLimit: { customers: 'tenants.notices.paused', owners: 'tenants.notices.ownerPaused' },
  Retrying: { customers: 'tenants.notices.retrying', owners: 'tenants.notices.ownerRetrying' },
} as const

/** Progress of the emails of a suspension that cancelled appointments (DEC-039): counts only. */
export function SuspensionNoticesLine({ notices }: { notices: PlatformSuspensionNotices }) {
  const { t } = useTranslation('platform')
  const { customers, sent, notSent, ownerSummaries, ownerSummariesSent, state } = notices
  const keys = state in stateKeys ? stateKeys[state as keyof typeof stateKeys] : null
  const ownersDone = ownerSummariesSent === ownerSummaries

  const parts: string[] = []
  if (customers === 0) {
    parts.push(t('tenants.notices.noCustomers'))
  } else if (keys) {
    parts.push(t(keys.customers, { sent, count: customers }))
  } else {
    parts.push(t('tenants.notices.done', { sent, count: customers }))
    if (notSent > 0) parts.push(t('tenants.notices.notSent', { count: notSent }))
  }

  if (ownerSummaries > 0) {
    if (ownersDone) {
      parts.push(t('tenants.notices.ownerSent', { count: ownerSummaries }))
    } else if (customers === 0 && keys) {
      // Only the owners are left to email: the line tells how that is going.
      parts.push(t(keys.owners, { count: ownerSummaries }))
    }
  }

  const paused = state === 'PausedDailyLimit' || state === 'Retrying'
  const Icon = paused ? Clock : Mail
  return (
    <p
      className={`mt-1.5 flex items-start gap-2 text-sm ${paused ? 'text-warning' : 'text-muted'}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{parts.join(' · ')}</span>
    </p>
  )
}
