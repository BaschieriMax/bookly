import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { formatDuration, formatPrice } from '@/lib/format'
import type { AdminService, AdminStaff } from '@/types/api'
import { useAdminServices, useAdminStaff, useDeleteService, useSaveService } from './adminApi'
import { adminErrorMessage } from './adminErrors'
import { AdminPageHeader, PageAction, Badge, EmptyState, QueryState } from './AdminUi'
import {
  formatPriceInput,
  intField,
  optionalText,
  parsePriceCents,
  PRICE_PATTERN,
  requiredText,
  validationMessage,
} from './formHelpers'

const schema = z.object({
  name: requiredText(80),
  description: optionalText(300),
  durationMinutes: intField(5, 600),
  bufferMinutes: intField(0, 120),
  price: z.string().trim().regex(PRICE_PATTERN, { error: 'price' }).or(z.literal('')),
  priceIsFrom: z.boolean(),
  isActive: z.boolean(),
  sortOrder: intField(0, 10_000),
})

type FormValues = z.infer<typeof schema>

function toFormValues(service: AdminService | null, nextOrder: number): FormValues {
  return {
    name: service?.name ?? '',
    description: service?.description ?? '',
    durationMinutes: service?.durationMinutes ?? 30,
    bufferMinutes: service?.bufferMinutes ?? 0,
    price: formatPriceInput(service?.priceCents ?? null),
    priceIsFrom: service?.priceIsFrom ?? false,
    isActive: service?.isActive ?? true,
    sortOrder: service?.sortOrder ?? nextOrder,
  }
}

interface ServiceFormDialogProps {
  service: AdminService | null
  nextOrder: number
  onClose: () => void
}

function ServiceFormDialog({ service, nextOrder, onClose }: ServiceFormDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const save = useSaveService()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(service, nextOrder),
  })
  const message = (key: string | undefined) => validationMessage(t, key)
  const formId = 'service-form'

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: service?.id ?? null,
        body: {
          name: values.name,
          description: values.description || null,
          durationMinutes: values.durationMinutes,
          bufferMinutes: values.bufferMinutes,
          priceCents: parsePriceCents(values.price),
          priceIsFrom: values.priceIsFrom,
          isActive: values.isActive,
          sortOrder: values.sortOrder,
        },
      })
      toast.success(t('saved'))
      onClose()
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  })

  return (
    <Dialog
      open
      title={service ? t('services.editTitle') : t('services.new')}
      closeLabel={t('actions.close')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {t('actions.save')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label={t('services.fields.name')}
          error={message(errors.name?.message)}
          {...register('name')}
        />
        <TextAreaField
          label={t('services.fields.description')}
          error={message(errors.description?.message)}
          {...register('description')}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            type="number"
            inputMode="numeric"
            label={t('services.fields.durationMinutes')}
            error={message(errors.durationMinutes?.message)}
            {...register('durationMinutes', { valueAsNumber: true })}
          />
          <TextField
            type="number"
            inputMode="numeric"
            label={t('services.fields.bufferMinutes')}
            hint={t('services.fields.bufferHint')}
            error={message(errors.bufferMinutes?.message)}
            {...register('bufferMinutes', { valueAsNumber: true })}
          />
        </div>
        <TextField
          inputMode="decimal"
          label={t('services.fields.price')}
          hint={t('services.fields.priceHint')}
          error={message(errors.price?.message)}
          {...register('price')}
        />
        <CheckboxField label={t('services.fields.priceIsFrom')} {...register('priceIsFrom')} />
        <CheckboxField
          label={t('services.fields.isActive')}
          description={t('services.fields.isActiveHint')}
          {...register('isActive')}
        />
        <TextField
          type="number"
          inputMode="numeric"
          label={t('services.fields.sortOrder')}
          className="max-w-40"
          error={message(errors.sortOrder?.message)}
          {...register('sortOrder', { valueAsNumber: true })}
        />
      </form>
    </Dialog>
  )
}

function staffNames(service: AdminService, staff: AdminStaff[] | undefined): string {
  const byId = new Map((staff ?? []).map((s) => [s.id, s.displayName]))
  return service.staffIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .join(', ')
}

export default function ServicesPage() {
  const { t } = useTranslation(['admin', 'common'])
  const { data: services, isPending, error } = useAdminServices()
  const { data: staff } = useAdminStaff()
  const remove = useDeleteService()
  const [editing, setEditing] = useState<AdminService | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<AdminService | null>(null)
  const nextOrder = (services?.reduce((max, s) => Math.max(max, s.sortOrder), 0) ?? 0) + 1

  const confirmDelete = async () => {
    if (!toDelete) return
    try {
      await remove.mutateAsync(toDelete.id)
      toast.success(t('deleted'))
    } catch (err) {
      toast.error(adminErrorMessage(t, err))
    } finally {
      setToDelete(null)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        title={t('services.title')}
        lead={t('services.lead')}
        action={
          <PageAction icon={Plus} label={t('services.new')} onClick={() => setEditing('new')} />
        }
      />

      <QueryState isPending={isPending} error={error}>
        {services?.length === 0 && <EmptyState>{t('services.empty')}</EmptyState>}
        <ul className="flex flex-col gap-3">
          {services?.map((service) => {
            const price = formatPrice(service.priceCents, service.priceIsFrom)
            const names = staffNames(service, staff)
            return (
              <li
                key={service.id}
                className="flex items-start gap-1 rounded-card border border-border bg-surface py-3 pr-2 pl-4 sm:items-center sm:py-4 sm:pl-5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1 sm:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{service.name}</h2>
                    {!service.isActive && <Badge>{t('inactive')}</Badge>}
                  </div>
                  <p className="text-sm text-muted">
                    {t('services.duration', {
                      duration: formatDuration(service.durationMinutes),
                      buffer: service.bufferMinutes,
                    })}{' '}
                    · {price ?? t('services.priceOnRequest')}
                  </p>
                  <p className="text-sm text-muted">
                    {names ? t('services.offeredBy', { names }) : t('services.offeredByNobody')}
                  </p>
                </div>
                {/* Icon buttons as in Staff: on phones they no longer take a row of their own. */}
                <Button
                  variant="ghost"
                  className="shrink-0 px-3"
                  onClick={() => setEditing(service)}
                  aria-label={`${t('actions.edit')} ${service.name}`}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  variant="ghostDanger"
                  className="shrink-0 px-3"
                  onClick={() => setToDelete(service)}
                  aria-label={`${t('actions.delete')} ${service.name}`}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      </QueryState>

      {editing && (
        <ServiceFormDialog
          service={editing === 'new' ? null : editing}
          nextOrder={nextOrder}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={t('services.deleteTitle')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.keep')}
        danger
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setToDelete(null)}
      >
        <p>{t('services.deleteText', { name: toDelete?.name ?? '' })}</p>
      </ConfirmDialog>
    </section>
  )
}
