import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { isApiError } from '@/services/apiClient'
import { useResetPassword } from './accountApi'
import { AuthCard, Notice } from './AuthCard'
import { TextLink } from '@/components/ui/TextLink'

/** Landing page of the reset link: /reimposta-password?email&token. */
export default function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common'])
  const [params] = useSearchParams()
  const reset = useResetPassword()
  const [password, setPassword] = useState('')
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (password.length >= 10) reset.mutate({ email, token, newPassword: password })
  }

  const error = reset.error
  const passwordError = isApiError(error, 400) && error.fieldErrors.newPassword?.[0]
  const tooShort = password.length > 0 && password.length < 10

  if (reset.isSuccess) {
    return (
      <AuthCard title={t('resetTitle')}>
        <Notice tone="success">{t('resetDone')}</Notice>
        <TextLink to="/login">{t('continueToLogin')}</TextLink>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('resetTitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {isApiError(error, 400) && error.code === 'auth.invalid_token' && (
          <Notice tone="danger">
            {t('errors.auth.invalid_token')}{' '}
            <Link to="/password-dimenticata" className="font-semibold underline">
              {t('sendLink')}
            </Link>
          </Notice>
        )}
        <TextField
          label={t('newPassword')}
          type="password"
          autoComplete="new-password"
          hint={t('passwordHint')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={
            tooShort
              ? t('validation.passwordTooShort')
              : passwordError
                ? t(`validation.${passwordError}` as 'validation.passwordTooShort', {
                    defaultValue: t('common:errors.generic'),
                  })
                : undefined
          }
        />
        <Button type="submit" loading={reset.isPending} disabled={!email || !token}>
          {t('savePassword')}
        </Button>
      </form>
    </AuthCard>
  )
}
