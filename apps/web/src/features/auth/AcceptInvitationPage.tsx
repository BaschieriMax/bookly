import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { paths } from '@/app/paths'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { TextField } from '@/components/ui/TextField'
import { isApiError } from '@/services/apiClient'
import { useAcceptInvitation, useInvitation } from './accountApi'
import { AuthCard, Notice } from './AuthCard'

/** Landing page of an owner invitation: /invito?userId&token (DEC-028). */
export default function AcceptInvitationPage() {
  const { t } = useTranslation(['auth', 'common'])
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const userId = params.get('userId') ?? ''
  const token = params.get('token') ?? ''
  const invitation = useInvitation(userId, token)
  const accept = useAcceptInvitation()
  const [password, setPassword] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (invitation.isPending && userId && token) return <PageSpinner />

  if (
    !invitation.data ||
    (isApiError(accept.error, 400) && accept.error.code === 'auth.invalid_token')
  ) {
    return (
      <AuthCard title={t('invalidLinkTitle')}>
        <Notice tone="danger">{t('invitationInvalidText')}</Notice>
        <Link to={paths.login} className="font-semibold text-primary-text">
          {t('continueToLogin')}
        </Link>
      </AuthCard>
    )
  }

  const { firstName, email, tenants } = invitation.data
  const tooShort = password.length < 10
  const serverError = isApiError(accept.error, 400)
    ? accept.error.fieldErrors.password?.[0]
    : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (tooShort || !privacy) return
    accept.mutate(
      { userId, token, password, acceptPrivacy: true },
      { onSuccess: () => void navigate(paths.admin.calendar, { replace: true }) },
    )
  }

  const passwordError =
    submitted && tooShort
      ? t('validation.passwordTooShort')
      : serverError
        ? t(`validation.${serverError}` as 'validation.passwordTooShort', {
            defaultValue: t('common:errors.generic'),
          })
        : undefined

  return (
    <AuthCard
      title={t('invitationTitle')}
      subtitle={t('invitationText', { firstName, tenants: tenants.join(', ') })}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('invitationEmail', { email })}</p>
        <TextField
          label={t('password')}
          type="password"
          autoComplete="new-password"
          hint={t('passwordHint')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
        />
        <div className="flex flex-col gap-1">
          <CheckboxField
            label={t('acceptPrivacy')}
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            aria-invalid={submitted && !privacy ? true : undefined}
          />
          <Link
            to={paths.privacy}
            target="_blank"
            className="text-sm font-semibold text-primary-text"
          >
            {t('privacyLink')}
          </Link>
          {submitted && !privacy && (
            <p className="text-sm text-danger">{t('validation.privacyRequired')}</p>
          )}
        </div>
        <Button type="submit" loading={accept.isPending}>
          {t('activate')}
        </Button>
      </form>
    </AuthCard>
  )
}
