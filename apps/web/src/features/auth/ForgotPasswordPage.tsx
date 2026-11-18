import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { isApiError } from '@/services/apiClient'
import { useForgotPassword } from './accountApi'
import { AuthCard, Notice } from './AuthCard'

export default function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common'])
  const forgot = useForgotPassword()
  const [email, setEmail] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (email.trim()) forgot.mutate(email.trim())
  }

  return (
    <AuthCard title={t('forgotTitle')} subtitle={forgot.isSuccess ? undefined : t('forgotText')}>
      {forgot.isSuccess ? (
        <Notice tone="success">{t('forgotSent')}</Notice>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {forgot.isError && (
            <Notice tone="danger">
              {isApiError(forgot.error, 429)
                ? t('common:errors.tooManyRequests')
                : t('common:errors.generic')}
            </Notice>
          )}
          <TextField
            label={t('email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" loading={forgot.isPending}>
            {t('sendLink')}
          </Button>
        </form>
      )}
      <Link to="/login" className="text-sm font-semibold text-primary-text">
        {t('continueToLogin')}
      </Link>
    </AuthCard>
  )
}
