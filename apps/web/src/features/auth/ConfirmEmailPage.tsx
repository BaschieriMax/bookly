import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { afterConfirm, useConfirmEmail } from './accountApi'
import { AuthCard, Notice } from './AuthCard'
import { safeRedirect } from './safeRedirect'

/** Landing page of the confirmation link: /conferma-email?userId&token. */
export default function ConfirmEmailPage() {
  const { t } = useTranslation('auth')
  const [params] = useSearchParams()
  const confirm = useConfirmEmail()
  const started = useRef(false)
  const userId = params.get('userId')
  const token = params.get('token')

  useEffect(() => {
    // Strict Mode runs effects twice in development: the token can be used only once.
    if (started.current || !userId || !token) return
    started.current = true
    confirm.mutate({ userId, token })
  }, [confirm, userId, token])

  if (!userId || !token || confirm.isError) {
    return (
      <AuthCard title={t('invalidLinkTitle')}>
        <Notice tone="danger">{t('invalidLinkText')}</Notice>
        <Link to="/login" className="font-semibold text-primary-text">
          {t('continueToLogin')}
        </Link>
      </AuthCard>
    )
  }

  if (!confirm.isSuccess) {
    return (
      <AuthCard title={t('confirmTitle')} subtitle={t('confirming')}>
        <PageSpinner />
      </AuthCard>
    )
  }

  const next = afterConfirm.take()
  return (
    <AuthCard title={t('confirmedTitle')}>
      <Notice tone="success">{t('confirmedText')}</Notice>
      <Link
        to={`/login?redirect=${encodeURIComponent(safeRedirect(next))}`}
        className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 font-semibold text-primary-fg"
      >
        {t('continueToLogin')}
      </Link>
    </AuthCard>
  )
}
