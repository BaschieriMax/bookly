import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { isApiError } from '@/services/apiClient'
import { afterConfirm, useRegister } from './accountApi'
import { AuthCard, Notice } from './AuthCard'
import { safeRedirect } from './safeRedirect'

const schema = z.object({
  firstName: z.string().trim().min(1, 'firstNameRequired').max(100),
  lastName: z.string().trim().min(1, 'lastNameRequired').max(100),
  email: z.string().trim().min(1, 'emailRequired').email('emailInvalid'),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s./-]{5,29}$/, 'phoneInvalid')
    .or(z.literal('')),
  password: z.string().min(10, 'passwordTooShort').max(128),
  acceptPrivacy: z.literal(true, { message: 'privacyRequired' }),
})

type FormValues = z.input<typeof schema>

export default function RegisterPage() {
  const { t } = useTranslation(['auth', 'common'])
  const [params] = useSearchParams()
  const register = useRegister()
  const redirect = params.get('redirect')

  const {
    register: field,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      acceptPrivacy: false as never,
    },
  })

  const message = (key: string | undefined) =>
    key
      ? t(`validation.${key}` as 'validation.emailRequired', {
          defaultValue: t('common:errors.generic'),
        })
      : undefined

  const onSubmit = handleSubmit(async (values) => {
    try {
      await register.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: values.phoneNumber || null,
        password: values.password,
        acceptPrivacy: true,
      })
      if (redirect) afterConfirm.save(safeRedirect(redirect))
    } catch (error) {
      if (isApiError(error, 400)) {
        for (const [name, codes] of Object.entries(error.fieldErrors)) {
          const key =
            name.toLowerCase() === 'email'
              ? 'email'
              : name.toLowerCase().includes('password')
                ? 'password'
                : null
          if (key && codes[0]) setError(key, { message: codes[0] })
        }
      }
    }
  })

  if (register.isSuccess) {
    return (
      <AuthCard title={t('checkEmailTitle')}>
        <Notice tone="success">{t('checkEmailText')}</Notice>
        <Link to="/login" className="font-semibold text-primary-text">
          {t('continueToLogin')}
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('registerTitle')} subtitle={t('registerSubtitle')}>
      <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        {register.isError && !isApiError(register.error, 400) && (
          <Notice tone="danger">
            {isApiError(register.error, 429)
              ? t('common:errors.tooManyRequests')
              : t('common:errors.generic')}
          </Notice>
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('firstName')}
            autoComplete="given-name"
            error={message(errors.firstName?.message)}
            {...field('firstName')}
          />
          <TextField
            label={t('lastName')}
            autoComplete="family-name"
            error={message(errors.lastName?.message)}
            {...field('lastName')}
          />
        </div>
        <TextField
          label={t('email')}
          type="email"
          autoComplete="email"
          error={message(errors.email?.message)}
          {...field('email')}
        />
        <TextField
          label={t('phone')}
          type="tel"
          autoComplete="tel"
          hint={t('phoneHint')}
          error={message(errors.phoneNumber?.message)}
          {...field('phoneNumber')}
        />
        <TextField
          label={t('password')}
          type="password"
          autoComplete="new-password"
          hint={t('passwordHint')}
          error={message(errors.password?.message)}
          {...field('password')}
        />
        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              aria-invalid={!!errors.acceptPrivacy}
              {...field('acceptPrivacy')}
            />
            <span>
              {t('acceptPrivacy')} ·{' '}
              <Link
                to="/privacy"
                target="_blank"
                className="font-semibold text-primary-text underline"
              >
                {t('privacyLink')}
              </Link>
            </span>
          </label>
          {errors.acceptPrivacy && (
            <p className="text-sm text-danger">{t('validation.privacyRequired')}</p>
          )}
        </div>
        <Button type="submit" loading={register.isPending}>
          {register.isPending ? t('creating') : t('createAccount')}
        </Button>
      </form>
      <p className="text-sm text-muted">
        {t('haveAccount')}{' '}
        <Link
          to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
          className="font-semibold text-primary-text"
        >
          {t('submit')}
        </Link>
      </p>
    </AuthCard>
  )
}
