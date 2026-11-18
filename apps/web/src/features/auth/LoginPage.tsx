import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { isApiError } from '@/services/apiClient'
import { safeRedirect } from './safeRedirect'
import { useLogin } from './useMe'

const schema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(1, 'passwordRequired'),
  rememberMe: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const loginMutation = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await loginMutation.mutateAsync(values)
    } catch {
      return // shown through loginMutation.error
    }
    await navigate(safeRedirect(params.get('redirect')), { replace: true })
  })

  const apiError = loginMutation.error
  const apiErrorCode = isApiError(apiError) ? apiError.code : null
  const apiErrorMessage = (() => {
    if (!apiError) return null
    if (apiErrorCode === 'auth.invalid_credentials') return t('errors.auth.invalid_credentials')
    if (apiErrorCode === 'auth.invalid_antiforgery') return t('errors.auth.invalid_antiforgery')
    if (isApiError(apiError, 429)) return t('common:errors.tooManyRequests')
    return t('common:errors.generic')
  })()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t('loginTitle')}</h1>
        <p className="text-muted">{t('loginSubtitle')}</p>
      </div>

      <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        {apiErrorMessage && (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            {apiErrorMessage}
          </p>
        )}
        <TextField
          label={t('email')}
          type="email"
          autoComplete="email"
          error={
            errors.email?.message === 'emailInvalid'
              ? t('validation.emailInvalid')
              : errors.email
                ? t('validation.emailRequired')
                : undefined
          }
          {...register('email')}
        />
        <TextField
          label={t('password')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message ? t('validation.passwordRequired') : undefined}
          {...register('password')}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" {...register('rememberMe')} />
          {t('rememberMe')}
        </label>
        <Button type="submit" loading={loginMutation.isPending}>
          {loginMutation.isPending ? t('submitting') : t('submit')}
        </Button>
      </form>

      <div className="flex flex-col gap-2 text-sm">
        <Link to="/password-dimenticata" className="font-semibold text-primary">
          {t('forgotPassword')}
        </Link>
        <p className="text-muted">
          {t('noAccount')}{' '}
          <Link to="/registrati" className="font-semibold text-primary">
            {t('register')}
          </Link>
        </p>
      </div>
    </main>
  )
}
