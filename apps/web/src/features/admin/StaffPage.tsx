import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import type { AdminService, AdminStaff } from '@/types/api'
import { useAdminServices, useAdminStaff, useDeleteStaff, useSaveStaff } from './adminApi'
import { adminErrorMessage } from './adminErrors'
import { AdminPageHeader, PageAction, Badge, EmptyState, QueryState } from './AdminUi'
import { intField, requiredText, validationMessage } from './formHelpers'

const schema = z.object({
  displayName: requiredText(80),
  isActive: z.boolean(),
  sortOrder: intField(0, 10_000),
  serviceIds: z.array(z.string()),
})

type FormValues = z.infer<typeof schema>

interface StaffFormDialogProps {
  member: AdminStaff | null
  services: AdminService[]
  nextOrder: number
  onClose: () => void
}

function StaffFormDialog({ member, services, nextOrder, onClose }: StaffFormDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const save = useSaveStaff()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: member?.displayName ?? '',
      isActive: member?.isActive ?? true,
      sortOrder: member?.sortOrder ?? nextOrder,
      serviceIds: member?.serviceIds ?? [],
    },
  })
  const message = (key: string | undefined) => validationMessage(t, key)
  const formId = 'staff-form'

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: member?.id ?? null, body: values })
      toast.success(t('saved'))
      onClose()
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  })

  return (
    <Dialog
      open
      title={member ? t('staff.editTitle') : t('staff.new')}
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
          label={t('staff.fields.displayName')}
          error={message(errors.displayName?.message)}
          {...register('displayName')}
        />
        <CheckboxField
          label={t('staff.fields.isActive')}
          description={t('staff.fields.isActiveHint')}
          {...register('isActive')}
        />
        <TextField
          type="number"
          inputMode="numeric"
          label={t('staff.fields.sortOrder')}
          className="max-w-40"
          error={message(errors.sortOrder?.message)}
          {...register('sortOrder', { valueAsNumber: true })}
        />
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">{t('staff.fields.services')}</legend>
          {services.length === 0 && (
            <p className="text-sm text-muted">{t('staff.fields.noServices')}</p>
          )}
          {services.map((service) => (
            <CheckboxField
              key={service.id}
              value={service.id}
              label={service.name}
              {...register('serviceIds')}
            />
          ))}
        </fieldset>
      </form>
    </Dialog>
  )
}

export default function StaffPage() {
  const { t } = useTranslation(['admin', 'common'])
  const { data: staff, isPending, error } = useAdminStaff()
  const { data: services } = useAdminServices()
  const remove = useDeleteStaff()
  const [editing, setEditing] = useState<AdminStaff | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<AdminStaff | null>(null)
  const nextOrder = (staff?.reduce((max, s) => Math.max(max, s.sortOrder), 0) ?? 0) + 1

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
        title={t('staff.title')}
        lead={t('staff.lead')}
        action={<PageAction icon={Plus} label={t('staff.new')} onClick={() => setEditing('new')} />}
      />

      <QueryState isPending={isPending} error={error}>
        {staff?.length === 0 && <EmptyState>{t('staff.empty')}</EmptyState>}
        <ul className="grid gap-3 lg:grid-cols-2">
          {staff?.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-card border border-border bg-surface p-4"
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-subtle text-muted"
              >
                <UserRound className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold">{member.displayName}</h2>
                  {member.isMe && <Badge tone="primary">{t('staff.me')}</Badge>}
                  {!member.isActive && <Badge>{t('inactive')}</Badge>}
                </div>
                <p className="text-sm text-muted">
                  {t('staff.servicesCount', { count: member.serviceIds.length })}
                  {member.hasLogin && ` · ${t('staff.hasLogin')}`}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setEditing(member)}
                aria-label={`${t('actions.edit')} ${member.displayName}`}
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Button>
              <Button
                variant="ghostDanger"
                onClick={() => setToDelete(member)}
                aria-label={`${t('actions.delete')} ${member.displayName}`}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </QueryState>

      {editing && (
        <StaffFormDialog
          member={editing === 'new' ? null : editing}
          services={services ?? []}
          nextOrder={nextOrder}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={t('staff.deleteTitle')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.keep')}
        danger
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setToDelete(null)}
      >
        <p>{t('staff.deleteText', { name: toDelete?.displayName ?? '' })}</p>
      </ConfirmDialog>
    </section>
  )
}
