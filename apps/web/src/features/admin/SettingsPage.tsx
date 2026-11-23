import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink } from 'lucide-react'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import type { TenantSettings } from '@/types/api'
import { useSaveTenantSettings, useTenantSettings } from './adminApi'
import { adminErrorMessage } from './adminErrors'
import { AdminPageHeader, Panel, QueryState } from './AdminUi'
import { intField, optionalText, requiredText, validationMessage } from './formHelpers'

const SLOT_INTERVALS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const

/** European zones first: Bookly targets Italian businesses, but any IANA zone is valid. */
function timeZoneOptions(current: string): string[] {
  const all = Intl.supportedValuesOf('timeZone').filter((z) => z.startsWith('Europe/'))
  return all.includes(current) ? all : [current, ...all]
}

const schema = z.object({
  name: requiredText(120),
  phone: optionalText(30).regex(/^([+\d][\d\s./-]{5,29})?$/, { error: 'phone' }),
  address: optionalText(200),
  timeZone: z.string().min(1, { error: 'required' }),
  cancellationWindowHours: intField(0, 168),
  slotIntervalMinutes: intField(5, 120),
  minNoticeMinutes: intField(0, 10_080),
  bookingHorizonDays: intField(1, 365),
  notifyOnOnlineBooking: z.boolean(),
  notifyOnCustomerCancellation: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function SettingsForm({ settings }: { settings: TenantSettings }) {
  const { t } = useTranslation(['admin', 'common'])
  const save = useSaveTenantSettings()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...settings, phone: settings.phone ?? '', address: settings.address ?? '' },
  })
  const message = (key: string | undefined) => validationMessage(t, key)
  const notificationsHintId = useId()

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        ...values,
        phone: values.phone || null,
        address: values.address || null,
      })
      reset({ ...saved, phone: saved.phone ?? '', address: saved.address ?? '' })
      toast.success(t('saved'))
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      <Panel title={t('settings.business')}>
        <TextField
          label={t('settings.fields.name')}
          error={message(errors.name?.message)}
          {...register('name')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            type="tel"
            autoComplete="tel"
            label={t('settings.fields.phone')}
            error={message(errors.phone?.message)}
            {...register('phone')}
          />
          <SelectField
            label={t('settings.fields.timeZone')}
            options={timeZoneOptions(settings.timeZone).map((z) => ({ value: z, label: z }))}
            {...register('timeZone')}
          />
        </div>
        <TextField
          autoComplete="street-address"
          label={t('settings.fields.address')}
          error={message(errors.address?.message)}
          {...register('address')}
        />
      </Panel>

      <Panel title={t('settings.rules')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            type="number"
            inputMode="numeric"
            label={t('settings.fields.cancellationWindowHours')}
            hint={t('settings.fields.cancellationWindowHint')}
            error={message(errors.cancellationWindowHours?.message)}
            {...register('cancellationWindowHours', { valueAsNumber: true })}
          />
          <SelectField
            label={t('settings.fields.slotIntervalMinutes')}
            options={SLOT_INTERVALS.map((m) => ({
              value: String(m),
              label: t('settings.minutes', { count: m }),
            }))}
            {...register('slotIntervalMinutes', { valueAsNumber: true })}
          />
          <TextField
            type="number"
            inputMode="numeric"
            label={t('settings.fields.minNoticeMinutes')}
            hint={t('settings.fields.minNoticeHint')}
            error={message(errors.minNoticeMinutes?.message)}
            {...register('minNoticeMinutes', { valueAsNumber: true })}
          />
          <TextField
            type="number"
            inputMode="numeric"
            label={t('settings.fields.bookingHorizonDays')}
            error={message(errors.bookingHorizonDays?.message)}
            {...register('bookingHorizonDays', { valueAsNumber: true })}
          />
        </div>
      </Panel>

      <Panel title={t('settings.notifications')}>
        <p id={notificationsHintId} className="-mt-2 text-sm text-muted">
          {t('settings.notificationsHint')}
        </p>
        <fieldset aria-describedby={notificationsHintId} className="flex min-w-0 flex-col gap-1">
          <legend className="sr-only">{t('settings.notificationsLegend')}</legend>
          <CheckboxField
            label={t('settings.fields.notifyOnOnlineBooking')}
            description={t('settings.fields.notifyOnOnlineBookingHint')}
            {...register('notifyOnOnlineBooking')}
          />
          <CheckboxField
            label={t('settings.fields.notifyOnCustomerCancellation')}
            description={t('settings.fields.notifyOnCustomerCancellationHint')}
            {...register('notifyOnCustomerCancellation')}
          />
        </fieldset>
      </Panel>

      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          {t('actions.saveChanges')}
        </Button>
      </div>
    </form>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation('admin')
  const { data: settings, isPending, error } = useTenantSettings()

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        title={t('settings.title')}
        lead={t('settings.lead')}
        action={
          settings && (
            <Link
              to={`/b/${settings.slug}`}
              target="_blank"
              className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary-text"
            >
              {t('settings.publicLink')}
              <ExternalLink aria-hidden="true" className="size-4" />
            </Link>
          )
        }
      />
      <QueryState isPending={isPending} error={error}>
        {settings && <SettingsForm settings={settings} />}
      </QueryState>
    </section>
  )
}
