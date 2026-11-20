import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, MailPlus, Pause, Play, Plus, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import { AdminPageHeader, Badge, EmptyState, QueryState } from '@/features/admin/AdminUi'
import { SLUG_PATTERN, slugify } from '@/lib/slug'
import type { PlatformOwner, PlatformTenant } from '@/types/api'
import {
  useCreateTenant,
  useInviteOwner,
  usePlatformTenants,
  useSetTenantStatus,
} from './platformApi'
import { platformErrorMessage } from './platformErrors'

const owner = {
  ownerEmail: z.string().trim().email(),
  ownerFirstName: z.string().trim().min(1).max(100),
  ownerLastName: z.string().trim().min(1).max(100),
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(SLUG_PATTERN),
  timeZone: z.string().min(1),
  ...owner,
})

const inviteSchema = z.object(owner)

type CreateValues = z.infer<typeof createSchema>
type InviteValues = z.infer<typeof inviteSchema>

const europeanZones = () =>
  Intl.supportedValuesOf('timeZone').filter((z) => z.startsWith('Europe/'))

const dateFormat = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

interface OwnerFieldsProps {
  email: UseFormRegisterReturn
  firstName: UseFormRegisterReturn
  lastName: UseFormRegisterReturn
  invalid: { email: boolean; firstName: boolean; lastName: boolean }
}

/** Email + name of the owner to invite: shared by "new tenant" and "add owner". */
function OwnerFields({ email, firstName, lastName, invalid }: OwnerFieldsProps) {
  const { t } = useTranslation(['platform', 'auth'])
  return (
    <>
      <TextField
        type="email"
        autoComplete="off"
        label={t('tenants.fields.ownerEmail')}
        error={invalid.email ? t('auth:validation.emailInvalid') : undefined}
        {...email}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label={t('tenants.fields.ownerFirstName')}
          error={invalid.firstName ? t('auth:validation.firstNameRequired') : undefined}
          {...firstName}
        />
        <TextField
          label={t('tenants.fields.ownerLastName')}
          error={invalid.lastName ? t('auth:validation.lastNameRequired') : undefined}
          {...lastName}
        />
      </div>
      <p className="text-sm text-muted">{t('tenants.fields.ownerHint')}</p>
    </>
  )
}

function CreateTenantDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['platform', 'common', 'admin'])
  const create = useCreateTenant()
  const [slugEdited, setSlugEdited] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      slug: '',
      timeZone: 'Europe/Rome',
      ownerEmail: '',
      ownerFirstName: '',
      ownerLastName: '',
    },
  })
  const slug = useWatch({ control, name: 'slug' })
  const formId = 'create-tenant-form'

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values)
      toast.success(t('tenants.created'))
      onClose()
    } catch (error) {
      toast.error(platformErrorMessage(t, error))
    }
  })

  const name = register('name')
  const slugField = register('slug')

  return (
    <Dialog
      open
      title={t('tenants.new')}
      closeLabel={t('admin:actions.close')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('admin:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={create.isPending}>
            {t('tenants.new')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label={t('tenants.fields.name')}
          error={errors.name ? t('admin:errors.validation.required') : undefined}
          {...name}
          onChange={(event) => {
            void name.onChange(event)
            if (!slugEdited) setValue('slug', slugify(event.target.value))
          }}
        />
        <TextField
          label={t('tenants.fields.slug')}
          hint={t('tenants.fields.slugHint', { slug: slug || '…' })}
          error={errors.slug ? t('errors.platform.invalid_slug') : undefined}
          spellCheck={false}
          {...slugField}
          onChange={(event) => {
            setSlugEdited(true)
            void slugField.onChange(event)
          }}
        />
        <SelectField
          label={t('tenants.fields.timeZone')}
          options={europeanZones().map((z) => ({ value: z, label: z }))}
          {...register('timeZone')}
        />
        <fieldset className="flex flex-col gap-4 border-t border-border pt-4">
          <legend className="pt-4 text-sm font-semibold">{t('tenants.fields.owner')}</legend>
          <OwnerFields
            email={register('ownerEmail')}
            firstName={register('ownerFirstName')}
            lastName={register('ownerLastName')}
            invalid={{
              email: !!errors.ownerEmail,
              firstName: !!errors.ownerFirstName,
              lastName: !!errors.ownerLastName,
            }}
          />
        </fieldset>
      </form>
    </Dialog>
  )
}

function InviteOwnerDialog({ tenant, onClose }: { tenant: PlatformTenant; onClose: () => void }) {
  const { t } = useTranslation(['platform', 'common', 'admin'])
  const invite = useInviteOwner()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { ownerEmail: '', ownerFirstName: '', ownerLastName: '' },
  })
  const formId = 'invite-owner-form'

  const onSubmit = handleSubmit(async (values) => {
    try {
      await invite.mutateAsync({
        id: tenant.id,
        body: {
          email: values.ownerEmail,
          firstName: values.ownerFirstName,
          lastName: values.ownerLastName,
        },
      })
      toast.success(t('tenants.ownerInvited'))
      onClose()
    } catch (error) {
      toast.error(platformErrorMessage(t, error))
    }
  })

  return (
    <Dialog
      open
      title={`${t('tenants.addOwner')} · ${tenant.name}`}
      closeLabel={t('admin:actions.close')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('admin:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={invite.isPending}>
            {t('tenants.addOwner')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <OwnerFields
          email={register('ownerEmail')}
          firstName={register('ownerFirstName')}
          lastName={register('ownerLastName')}
          invalid={{
            email: !!errors.ownerEmail,
            firstName: !!errors.ownerFirstName,
            lastName: !!errors.ownerLastName,
          }}
        />
      </form>
    </Dialog>
  )
}

function OwnerRow({ tenant, owner }: { tenant: PlatformTenant; owner: PlatformOwner }) {
  const { t } = useTranslation(['platform', 'common'])
  const invite = useInviteOwner()
  const name = `${owner.firstName} ${owner.lastName}`

  const resend = async () => {
    try {
      await invite.mutateAsync({
        id: tenant.id,
        body: { email: owner.email, firstName: owner.firstName, lastName: owner.lastName },
      })
      toast.success(t('tenants.resent'))
    } catch (error) {
      toast.error(platformErrorMessage(t, error))
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-medium">{name}</span>
      <span className="text-sm break-all text-muted">{owner.email}</span>
      {owner.pending && (
        <>
          <Badge tone="warning">{t('tenants.pending')}</Badge>
          <Button
            variant="ghost"
            className="min-w-11 px-2 text-sm"
            loading={invite.isPending}
            onClick={() => void resend()}
            aria-label={t('tenants.resend', { name })}
          >
            <Send aria-hidden="true" className="size-4" />
          </Button>
        </>
      )}
    </li>
  )
}

export default function TenantsPage() {
  const { t } = useTranslation(['platform', 'common', 'admin'])
  const { data: tenants, isPending, error } = usePlatformTenants()
  const setStatus = useSetTenantStatus()
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState<PlatformTenant | null>(null)
  const [suspending, setSuspending] = useState<PlatformTenant | null>(null)

  const changeStatus = async (tenant: PlatformTenant, status: 'Active' | 'Suspended') => {
    try {
      await setStatus.mutateAsync({ id: tenant.id, status })
      toast.success(status === 'Active' ? t('tenants.reactivated') : t('tenants.suspended'))
    } catch (err) {
      toast.error(platformErrorMessage(t, err))
    } finally {
      setSuspending(null)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        title={t('tenants.title')}
        lead={t('tenants.lead')}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t('tenants.new')}
          </Button>
        }
      />

      <QueryState isPending={isPending} error={error}>
        {tenants?.length === 0 && <EmptyState>{t('tenants.empty')}</EmptyState>}
        <ul className="flex flex-col gap-3">
          {tenants?.map((tenant) => {
            const active = tenant.status === 'Active'
            return (
              <li
                key={tenant.id}
                className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{tenant.name}</h2>
                      <Badge tone={active ? 'primary' : 'warning'}>
                        {t(`tenants.status.${tenant.status as 'Active' | 'Suspended'}`)}
                      </Badge>
                    </div>
                    <Link
                      to={`/b/${tenant.slug}`}
                      target="_blank"
                      className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-primary-text"
                    >
                      /b/{tenant.slug}
                      <span className="sr-only">
                        {' '}
                        ({t('tenants.publicPage', { name: tenant.name })})
                      </span>
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </Link>
                    <p className="text-sm text-muted">
                      {t('tenants.counts', {
                        staff: tenant.staffCount,
                        services: tenant.serviceCount,
                      })}{' '}
                      ·{' '}
                      {t('tenants.createdAt', {
                        date: dateFormat.format(new Date(tenant.createdAt)),
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setInviting(tenant)}>
                      <MailPlus aria-hidden="true" className="size-4" />
                      {t('tenants.addOwner')}
                    </Button>
                    {active ? (
                      <Button variant="danger" onClick={() => setSuspending(tenant)}>
                        <Pause aria-hidden="true" className="size-4" />
                        {t('tenants.suspend')}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        loading={setStatus.isPending && setStatus.variables?.id === tenant.id}
                        onClick={() => void changeStatus(tenant, 'Active')}
                      >
                        <Play aria-hidden="true" className="size-4" />
                        {t('tenants.reactivate')}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 border-t border-border pt-3">
                  <h3 className="text-sm font-semibold text-muted">{t('tenants.owners')}</h3>
                  {tenant.owners.length === 0 ? (
                    <p className="text-sm text-muted">{t('tenants.noOwners')}</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {tenant.owners.map((o) => (
                        <OwnerRow key={o.userId} tenant={tenant} owner={o} />
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </QueryState>

      {creating && <CreateTenantDialog onClose={() => setCreating(false)} />}
      {inviting && <InviteOwnerDialog tenant={inviting} onClose={() => setInviting(null)} />}
      <ConfirmDialog
        open={suspending !== null}
        title={t('tenants.suspendTitle', { name: suspending?.name ?? '' })}
        confirmLabel={t('tenants.suspend')}
        cancelLabel={t('admin:actions.cancel')}
        danger
        loading={setStatus.isPending}
        onConfirm={() => suspending && void changeStatus(suspending, 'Suspended')}
        onClose={() => setSuspending(null)}
      >
        <p>{t('tenants.suspendText')}</p>
      </ConfirmDialog>
    </section>
  )
}
