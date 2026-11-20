import { CalendarClock, CheckCircle2, Mail, Phone, UserX, XCircle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { formatPrice, longDate } from '@/lib/format'
import type { AdminAppointment, CalendarStaff } from '@/types/api'
import { adminErrorMessage } from '../adminErrors'
import { useCancelByBusiness, useMarkAppointment, useMoveAppointment } from './calendarApi'
import { dateOf, minutesOf, timeOf } from './calendarModel'
import { StatusBadge } from './StatusBadge'

type Mode = 'details' | 'move' | 'cancel'

interface AppointmentDialogProps {
  appointment: AdminAppointment
  staff: CalendarStaff[]
  timeZone: string
  canChooseStaff: boolean
  onClose: () => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Details of an appointment with the lifecycle actions the API allows (canMove, canCancel, canMark). */
export function AppointmentDialog({
  appointment,
  staff,
  timeZone,
  canChooseStaff,
  onClose,
}: AppointmentDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const [mode, setMode] = useState<Mode>('details')
  const move = useMoveAppointment()
  const cancel = useCancelByBusiness()
  const mark = useMarkAppointment()
  const [date, setDate] = useState(dateOf(appointment.start))
  const [time, setTime] = useState(timeOf(appointment.start))
  const [staffId, setStaffId] = useState(appointment.staffId)
  const [reason, setReason] = useState('')

  const staffName = staff.find((s) => s.id === appointment.staffId)?.displayName ?? ''
  const customer = `${appointment.customer.firstName} ${appointment.customer.lastName}`
  const price = formatPrice(appointment.priceCents, appointment.priceIsFrom)
  const buffer = minutesOf(appointment.blockedUntil) - minutesOf(appointment.end)

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action()
      toast.success(done)
      onClose()
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  }

  const title =
    mode === 'move'
      ? t('calendar.move.title')
      : mode === 'cancel'
        ? t('calendar.actions.cancel')
        : t('calendar.details.title')

  const footer =
    mode === 'move' ? (
      <>
        <Button variant="secondary" onClick={() => setMode('details')}>
          {t('calendar.actions.back')}
        </Button>
        <Button
          loading={move.isPending}
          disabled={!date || !time}
          onClick={() =>
            void run(
              () =>
                move.mutateAsync({
                  id: appointment.id,
                  body: { date, time, staffId: staffId === appointment.staffId ? null : staffId },
                }),
              t('calendar.move.done'),
            )
          }
        >
          {t('calendar.move.submit')}
        </Button>
      </>
    ) : mode === 'cancel' ? (
      <>
        <Button variant="secondary" onClick={() => setMode('details')}>
          {t('calendar.actions.back')}
        </Button>
        <Button
          variant="danger"
          loading={cancel.isPending}
          onClick={() =>
            void run(
              () => cancel.mutateAsync({ id: appointment.id, reason: reason.trim() || null }),
              t('calendar.cancel.done'),
            )
          }
        >
          {t('calendar.cancel.confirm')}
        </Button>
      </>
    ) : undefined

  return (
    <Dialog open title={title} closeLabel={t('actions.close')} onClose={onClose} footer={footer}>
      {mode === 'details' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{appointment.serviceName}</h3>
            <StatusBadge status={appointment.status} />
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label={t('calendar.details.when')}>
              <span className="first-letter:uppercase">
                {longDate(appointment.start, timeZone)}, {timeOf(appointment.start)}–
                {timeOf(appointment.end)}
              </span>
              {buffer > 0 && (
                <span className="block text-sm text-muted">
                  {t('calendar.details.bufferNote', { minutes: buffer })}
                </span>
              )}
            </Row>
            <Row label={t('calendar.details.staff')}>{staffName}</Row>
            <Row label={t('calendar.details.customer')}>
              <span className="block font-medium">{customer}</span>
              {!appointment.customer.hasAccount && (
                <span className="block text-sm text-muted">
                  {t('calendar.details.addressBook')}
                </span>
              )}
              {appointment.customer.phone && (
                <a
                  href={`tel:${appointment.customer.phone.replaceAll(' ', '')}`}
                  className="flex min-h-11 items-center gap-2 font-semibold text-primary-text"
                >
                  <Phone aria-hidden="true" className="size-4" />
                  {appointment.customer.phone}
                </a>
              )}
              {appointment.customer.email && (
                <a
                  href={`mailto:${appointment.customer.email}`}
                  className="flex min-h-11 items-center gap-2 font-semibold break-all text-primary-text"
                >
                  <Mail aria-hidden="true" className="size-4 shrink-0" />
                  {appointment.customer.email}
                </a>
              )}
            </Row>
            {price && <Row label={t('calendar.details.price')}>{price}</Row>}
            {appointment.customerNote && (
              <Row
                label={t(
                  appointment.origin === 'Business'
                    ? 'calendar.details.noteBusiness'
                    : 'calendar.details.note',
                )}
              >
                {appointment.customerNote}
              </Row>
            )}
            {appointment.cancellationReason && (
              <Row label={t('calendar.details.reason')}>{appointment.cancellationReason}</Row>
            )}
          </dl>

          {(appointment.canMark || appointment.canMove || appointment.canCancel) && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {appointment.canMark && (
                <>
                  <Button
                    loading={mark.isPending && mark.variables?.outcome === 'complete'}
                    onClick={() =>
                      void run(
                        () => mark.mutateAsync({ id: appointment.id, outcome: 'complete' }),
                        t('calendar.marked'),
                      )
                    }
                  >
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    {t('calendar.actions.complete')}
                  </Button>
                  <Button
                    variant="secondary"
                    loading={mark.isPending && mark.variables?.outcome === 'no-show'}
                    onClick={() =>
                      void run(
                        () => mark.mutateAsync({ id: appointment.id, outcome: 'no-show' }),
                        t('calendar.marked'),
                      )
                    }
                  >
                    <UserX aria-hidden="true" className="size-4" />
                    {t('calendar.actions.noShow')}
                  </Button>
                </>
              )}
              {appointment.canMove && (
                <Button variant="secondary" onClick={() => setMode('move')}>
                  <CalendarClock aria-hidden="true" className="size-4" />
                  {t('calendar.actions.move')}
                </Button>
              )}
              {appointment.canCancel && (
                <Button variant="danger" onClick={() => setMode('cancel')}>
                  <XCircle aria-hidden="true" className="size-4" />
                  {t('calendar.actions.cancel')}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {mode === 'move' && (
        <>
          <p className="text-muted">
            {appointment.serviceName} · {customer}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              type="date"
              label={t('calendar.move.date')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <TextField
              type="time"
              step={300}
              label={t('calendar.move.time')}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          {canChooseStaff && staff.length > 1 && (
            <SelectField
              label={t('calendar.move.staff')}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              options={staff.map((s) => ({ value: s.id, label: s.displayName }))}
            />
          )}
          <p className="text-sm text-muted">{t('calendar.move.hint')}</p>
        </>
      )}

      {mode === 'cancel' && (
        <>
          <p className="text-muted">
            {appointment.serviceName} · {customer} · {timeOf(appointment.start)}
          </p>
          <TextAreaField
            label={t('calendar.cancel.reason')}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-sm text-muted">{t('calendar.cancel.hint')}</p>
        </>
      )}
    </Dialog>
  )
}
