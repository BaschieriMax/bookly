import { TriangleAlert } from 'lucide-react'
import { useId, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { fieldClass, fieldLabelClass } from '@/components/ui/fieldStyles'
import { SheetBody, SheetFooter } from '@/components/ui/Sheet'
import { capitalize, longDate } from '@/lib/format'
import type { AdminAppointment } from '@/types/api'
import { StepHeader } from './AppointmentParts'
import { timeOf } from './calendarModel'

interface CancelAppointmentStepProps {
  appointment: AdminAppointment
  staffName: string
  timeZone: string
  headingId: string
  headingRef: Ref<HTMLHeadingElement>
  submitting: boolean
  onBack: () => void
  onClose: () => void
  onConfirm: (reason: string | null) => void
}

/**
 * "Annulla" step (DEC-044): what is being cancelled, an optional reason the customer will read
 * (frequent ones one tap away) and a clear warning that it cannot be undone.
 */
export function CancelAppointmentStep({
  appointment,
  staffName,
  timeZone,
  headingId,
  headingRef,
  submitting,
  onBack,
  onClose,
  onConfirm,
}: CancelAppointmentStepProps) {
  const { t } = useTranslation('admin')
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const quickReasons = t('calendar.cancel.reasons', { returnObjects: true })
  const customer = `${appointment.customer.firstName} ${appointment.customer.lastName}`

  return (
    <>
      <StepHeader
        headingId={headingId}
        headingRef={headingRef}
        title={t('calendar.cancel.title')}
        onBack={onBack}
        onClose={onClose}
      />
      <SheetBody>
        <div className="flex items-center gap-3 rounded-card border border-border p-3">
          <span className="font-heading text-xl font-semibold tabular-nums">
            {timeOf(appointment.start)}
          </span>
          <span className="flex min-w-0 flex-col text-sm">
            <strong className="truncate">
              {appointment.serviceName} · {customer}
            </strong>
            <span className="text-muted">
              {capitalize(longDate(appointment.start, timeZone))} · {staffName}
            </span>
          </span>
        </div>

        <div className="group flex flex-col gap-2">
          <label htmlFor={reasonId} className={fieldLabelClass}>
            {t('calendar.cancel.reason')}{' '}
            <span className="font-normal text-muted">{t('calendar.cancel.reasonHint')}</span>
          </label>
          <div
            role="group"
            aria-label={t('calendar.cancel.quickReasons')}
            className="flex flex-wrap gap-1.5"
          >
            {quickReasons.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => setReason(`${text}.`)}
                className="min-h-11 rounded-pill border border-border bg-surface px-3.5 text-sm font-medium text-ink transition-[border-color,transform] duration-150 hover:border-ink/60 active:scale-[0.97]"
              >
                {text}
              </button>
            ))}
          </div>
          <textarea
            id={reasonId}
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`resize-none px-3 py-2 ${fieldClass()}`}
          />
        </div>

        <p className="flex gap-2.5 rounded-card bg-danger-soft p-3 text-sm text-danger">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {appointment.customer.email
            ? t('calendar.cancel.warning', { name: appointment.customer.firstName })
            : t('calendar.cancel.warningNoEmail')}
        </p>
      </SheetBody>
      <SheetFooter className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 md:flex md:justify-end">
        <Button variant="secondary" onClick={onBack}>
          {t('calendar.actions.back')}
        </Button>
        <Button
          variant="dangerSolid"
          loading={submitting}
          onClick={() => onConfirm(reason.trim() || null)}
        >
          {t('calendar.cancel.confirm')}
        </Button>
      </SheetFooter>
    </>
  )
}
