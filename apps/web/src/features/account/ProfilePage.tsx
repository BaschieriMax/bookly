import { zodResolver } from '@hookform/resolvers/zod'
import { Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { paths } from '@/app/paths'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { TextField } from '@/components/ui/TextField'
import { isApiError } from '@/services/apiClient'
import type { Profile } from '@/types/api'
import { useDeleteAccount, useDownloadExport, useProfile, useUpdateProfile } from './privacyApi'

const schema = z.object({
  firstName: z.string().trim().min(1, 'required').max(100),
  lastName: z.string().trim().min(1, 'required').max(100),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s./-]{5,29}$/, 'phoneInvalid')
    .or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation(['account', 'common'])
  const update = useUpdateProfile()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phoneNumber: profile.phoneNumber ?? '',
    },
  })
  const message = (key?: string) => (key ? t(`profile.${key}` as 'profile.required') : undefined)

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({ ...values, phoneNumber: values.phoneNumber || null })
      reset({
        firstName: saved.firstName,
        lastName: saved.lastName,
        phoneNumber: saved.phoneNumber ?? '',
      })
      toast.success(t('profile.saved'))
    } catch {
      toast.error(t('common:errors.generic'))
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('profile.firstName')}
          autoComplete="given-name"
          error={message(errors.firstName?.message)}
          {...register('firstName')}
        />
        <TextField
          label={t('profile.lastName')}
          autoComplete="family-name"
          error={message(errors.lastName?.message)}
          {...register('lastName')}
        />
      </div>
      <TextField
        label={t('profile.phone')}
        type="tel"
        autoComplete="tel"
        hint={t('profile.phoneHint')}
        error={message(errors.phoneNumber?.message)}
        {...register('phoneNumber')}
      />
      <TextField
        label={t('profile.email')}
        value={profile.email}
        readOnly
        hint={t('profile.emailHint')}
      />
      <Button type="submit" className="self-start" loading={update.isPending} disabled={!isDirty}>
        {t('profile.save')}
      </Button>
    </form>
  )
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['account', 'common', 'admin'])
  const remove = useDeleteAccount()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const code = isApiError(remove.error) ? remove.error.code : null

  const confirm = () =>
    remove.mutate(password, {
      onSuccess: () => {
        toast.success(t('profile.deleted'))
        void navigate('/', { replace: true })
      },
    })

  return (
    <Dialog
      open
      title={t('profile.deleteConfirmTitle')}
      closeLabel={t('admin:actions.close')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('admin:actions.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            disabled={password.length === 0}
            onClick={confirm}
          >
            {t('profile.deleteConfirm')}
          </Button>
        </>
      }
    >
      <p className="text-muted">{t('profile.deleteText')}</p>
      <TextField
        label={t('profile.deletePassword')}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={
          code === 'account.invalid_password' ? t('errors.account.invalid_password') : undefined
        }
      />
      {code === 'account.owner_of_tenant' && (
        <p role="alert" className="rounded-control bg-danger-soft p-3 text-sm text-danger">
          {t('errors.account.owner_of_tenant')}
        </p>
      )}
      {remove.isError && !code && (
        <p role="alert" className="text-sm text-danger">
          {t('common:errors.generic')}
        </p>
      )}
    </Dialog>
  )
}

/** Customer's own data: rectification, portability and erasure (GDPR, DEC-030). */
export default function ProfilePage() {
  const { t } = useTranslation(['account', 'common'])
  const { data: profile, isPending } = useProfile()
  const download = useDownloadExport()
  const [deleting, setDeleting] = useState(false)

  if (isPending || !profile) return <PageSpinner />

  return (
    <section className="flex flex-col gap-5">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{t('profile.title')}</h1>

      <Section title={t('profile.personal')}>
        <ProfileForm profile={profile} />
      </Section>

      <Section title={t('profile.dataTitle')}>
        <p className="text-muted">{t('profile.dataText')}</p>
        <Button
          variant="secondary"
          className="self-start"
          loading={download.isPending}
          onClick={() =>
            download.mutate(undefined, {
              onSuccess: () => toast.success(t('profile.downloaded')),
              onError: () => toast.error(t('common:errors.generic')),
            })
          }
        >
          <Download aria-hidden="true" className="size-4" />
          {t('profile.download')}
        </Button>
        <Link to={paths.privacy} className="self-start font-semibold text-primary-text">
          {t('profile.privacyLink')}
        </Link>
      </Section>

      <Section title={t('profile.deleteTitle')}>
        <p className="text-muted">{t('profile.deleteText')}</p>
        <Button variant="danger" className="self-start" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden="true" className="size-4" />
          {t('profile.deleteButton')}
        </Button>
      </Section>

      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </section>
  )
}
