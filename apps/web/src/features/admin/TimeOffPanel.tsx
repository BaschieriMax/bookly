import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { Dialog } from '@/components/ui/Dialog'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { TextField } from '@/components/ui/TextField'
import { dateKey, shortDateOfKey } from '@/lib/format'
import type { TimeOff } from '@/types/api'
import { useAddTimeOff, useDeleteTimeOff, useTimeOff } from './adminApi'
import { adminErrorMessage } from './adminErrors'
import { EmptyState, Panel } from './AdminUi'
import { optionalText, validationMessage } from './formHelpers'
import { periodOf } from './scheduleModel'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

const schema = z
  .object({
    startDate: z.string().regex(DATE, { error: 'required' }),
    endDate: z.string().regex(DATE, { error: 'required' }),
    wholeDays: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    reason: optionalText(200),
  })
  .superRefine((values, ctx) => {
    if (!values.wholeDays) {
      if (!TIME.test(values.startTime))
        ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'required' })
      if (!TIME.test(values.endTime))
        ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'required' })
    }
  })

type FormValues = z.infer<typeof schema>

function AddTimeOffDialog({ staffId, onClose }: { staffId: string; onClose: () => void }) {
  const { t } = useTranslation(['admin', 'common'])
  const add = useAddTimeOff(staffId)
  const today = dateKey(new Date())
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      startDate: today,
      endDate: today,
      wholeDays: true,
      startTime: '09:00',
      endTime: '13:00',
      reason: '',
    },
  })
  const wholeDays = useWatch({ control, name: 'wholeDays' })
  const message = (key: string | undefined) => validationMessage(t, key)
  const formId = 'time-off-form'

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await add.mutateAsync({
        startDate: values.startDate,
        endDate: values.endDate,
        startTime: values.wholeDays ? null : values.startTime,
        endTime: values.wholeDays ? null : values.endTime,
        reason: values.reason || null,
      })
      toast.success(t('schedule.timeOffAdded'))
      if (created.conflictingAppointments > 0) {
        toast(t('schedule.timeOffConflicts', { count: created.conflictingAppointments }), {
          icon: '⚠️',
          duration: 8000,
        })
      }
      onClose()
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  })

  return (
    <Dialog
      open
      title={t('schedule.addTimeOff')}
      closeLabel={t('actions.close')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={add.isPending}>
            {t('actions.add')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <TextField
            type="date"
            label={t('schedule.startDate')}
            error={message(errors.startDate?.message)}
            {...register('startDate')}
          />
          <TextField
            type="date"
            label={t('schedule.endDate')}
            error={message(errors.endDate?.message)}
            {...register('endDate')}
          />
        </div>
        <CheckboxField label={t('schedule.wholeDays')} {...register('wholeDays')} />
        {!wholeDays && (
          <div className="grid grid-cols-2 gap-4">
            <TextField
              type="time"
              label={t('schedule.startTime')}
              error={message(errors.startTime?.message)}
              {...register('startTime')}
            />
            <TextField
              type="time"
              label={t('schedule.endTime')}
              error={message(errors.endTime?.message)}
              {...register('endTime')}
            />
          </div>
        )}
        <TextField
          label={t('schedule.reason')}
          hint={t('schedule.reasonHint')}
          error={message(errors.reason?.message)}
          {...register('reason')}
        />
      </form>
    </Dialog>
  )
}

function usePeriodLabel() {
  const { t } = useTranslation('admin')
  return (timeOff: TimeOff) => {
    const period = periodOf(timeOff)
    const start = shortDateOfKey(period.startDate)
    const end = shortDateOfKey(period.endDate)
    if (period.wholeDays) {
      return period.startDate === period.endDate
        ? t('schedule.periodDay', { start })
        : t('schedule.periodDays', { start, end })
    }
    if (period.startDate === period.endDate) {
      return t('schedule.periodSameDay', {
        start,
        startTime: period.startTime,
        endTime: period.endTime,
      })
    }
    return t('schedule.periodTimes', {
      start,
      startTime: period.startTime,
      end,
      endTime: period.endTime,
    })
  }
}

/** Upcoming time off of a staff member (last 30 days included), with add and delete. */
export function TimeOffPanel({ staffId }: { staffId: string }) {
  const { t } = useTranslation(['admin', 'common'])
  const { data: items, isPending } = useTimeOff(staffId)
  const remove = useDeleteTimeOff(staffId)
  const [adding, setAdding] = useState(false)
  const label = usePeriodLabel()

  const onDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id)
      toast.success(t('deleted'))
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  }

  return (
    <Panel title={t('schedule.timeOffTitle')}>
      {isPending && <PageSpinner />}
      {items?.length === 0 && <EmptyState>{t('schedule.timeOffEmpty')}</EmptyState>}
      <ul className="flex flex-col gap-2">
        {items?.map((item) => {
          const period = label(item)
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-control border border-border p-3"
            >
              <CalendarOff aria-hidden="true" className="size-5 shrink-0 text-muted" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium first-letter:uppercase">{period}</span>
                {item.reason && <span className="text-sm text-muted">{item.reason}</span>}
              </div>
              <Button
                variant="ghost"
                className="px-3"
                onClick={() => void onDelete(item.id)}
                aria-label={t('schedule.deleteTimeOff', { period })}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </li>
          )
        })}
      </ul>
      <Button variant="secondary" className="self-start" onClick={() => setAdding(true)}>
        <Plus aria-hidden="true" className="size-4" />
        {t('schedule.addTimeOff')}
      </Button>
      {adding && <AddTimeOffDialog staffId={staffId} onClose={() => setAdding(false)} />}
    </Panel>
  )
}
