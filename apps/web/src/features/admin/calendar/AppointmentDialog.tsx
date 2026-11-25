import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Globe,
  Info,
  Mail,
  Phone,
  Plus,
  Store,
  UserX,
  XCircle,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Sheet, SheetBody, SheetFooter } from '@/components/ui/Sheet'
import { capitalize, formatDuration, formatPrice, longDate } from '@/lib/format'
import { telHref } from '@/lib/tel'
import type { AdminAppointment, CalendarStaff } from '@/types/api'
import { useAdminStaff } from '../adminApi'
import { adminErrorMessage } from '../adminErrors'
import { Avatar, CloseButton } from './AppointmentParts'
import { useCancelByBusiness, useMarkAppointment, useMoveAppointment } from './calendarApi'
import { isCancelled, timeOf } from './calendarModel'
import { CancelAppointmentStep } from './CancelAppointmentStep'
import { lengthOf, type MovePreview } from './moveModel'
import { MoveAppointmentStep } from './MoveAppointmentStep'
import { StatusBadge } from './StatusBadge'
import { statusTone, type AppointmentStatus } from './statusStyles'

type Mode = 'details' | 'move' | 'cancel'

interface AppointmentDialogProps {
  appointment: AdminAppointment
  staff: CalendarStaff[]
  timeZone: string
  canChooseStaff: boolean
  onClose: () => void
  /** Desktop grid: where the appointment would go while choosing a new time. */
  onPreview?: (preview: MovePreview | null) => void
  /** "Prenota di nuovo": a new appointment for the same customer and service. */
  onRebook?: (appointment: AdminAppointment) => void
}

/**
 * Details of an appointment (DEC-044): a bottom sheet on phones, a panel next to the calendar on
 * desktop. The actions follow the state the API reports (canMove, canCancel, canMark): a future
 * appointment can be moved or cancelled, one that has started is marked, the others are read only.
 */
export function AppointmentDialog({
  appointment,
  staff,
  timeZone,
  canChooseStaff,
  onClose,
  onPreview,
  onRebook,
}: AppointmentDialogProps) {
  const { t } = useTranslation('admin')
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [mode, setMode] = useState<Mode>('details')
  const move = useMoveAppointment()
  const cancel = useCancelByBusiness()
  const mark = useMarkAppointment()
  const { data: allStaff } = useAdminStaff()

  // Each step names the sheet with its own heading: move focus there, as a new page would.
  useEffect(() => {
    headingRef.current?.focus()
  }, [mode])

  const staffName =
    staff.find((s) => s.id === appointment.staffId)?.displayName ??
    allStaff?.find((s) => s.id === appointment.staffId)?.displayName ??
    ''
  const { firstName, lastName, phone, email, hasAccount, id: customerId } = appointment.customer
  const customer = `${firstName} ${lastName}`
  const { durationMinutes, bufferMinutes } = lengthOf(appointment)
  const status = appointment.status as AppointmentStatus
  const cancelled = isCancelled(status)

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action()
      toast.success(done)
      onClose()
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  }

  // Every step renders the same Sheet: React keeps it mounted, so it does not slide in again.
  if (mode === 'move') {
    return (
      <Sheet labelledBy={headingId} onClose={onClose}>
        <MoveAppointmentStep
          appointment={appointment}
          timeZone={timeZone}
          canChooseStaff={canChooseStaff}
          headingId={headingId}
          headingRef={headingRef}
          submitting={move.isPending}
          onBack={() => setMode('details')}
          onClose={onClose}
          onPreview={onPreview}
          onSubmit={(target) =>
            void run(
              () =>
                move.mutateAsync({
                  id: appointment.id,
                  body: {
                    date: target.date,
                    time: target.time,
                    staffId: target.staffId === appointment.staffId ? null : target.staffId,
                  },
                }),
              t('calendar.move.done', { when: target.when }),
            )
          }
        />
      </Sheet>
    )
  }

  if (mode === 'cancel') {
    return (
      <Sheet labelledBy={headingId} onClose={onClose}>
        <CancelAppointmentStep
          appointment={appointment}
          staffName={staffName}
          timeZone={timeZone}
          headingId={headingId}
          headingRef={headingRef}
          submitting={cancel.isPending}
          onBack={() => setMode('details')}
          onClose={onClose}
          onConfirm={(reason) =>
            void run(
              () => cancel.mutateAsync({ id: appointment.id, reason }),
              t('calendar.cancel.done'),
            )
          }
        />
      </Sheet>
    )
  }

  const banner = appointment.canMark
    ? {
        tone: statusTone.Confirmed,
        title: t('calendar.details.startedTitle', { time: timeOf(appointment.start) }),
        text: t('calendar.details.startedText'),
      }
    : status === 'Completed'
      ? { tone: statusTone.Completed, text: t('calendar.details.completedText') }
      : status === 'NoShow'
        ? { tone: statusTone.NoShow, text: t('calendar.details.noShowText') }
        : cancelled
          ? {
              tone: statusTone[status],
              text: appointment.cancellationReason
                ? t('calendar.details.reason', { reason: appointment.cancellationReason })
                : t(
                    status === 'CancelledByCustomer'
                      ? 'calendar.details.cancelledByCustomerText'
                      : 'calendar.details.cancelledByBusinessText',
                  ),
            }
          : null

  const markAs = (outcome: 'complete' | 'no-show') =>
    void run(
      () => mark.mutateAsync({ id: appointment.id, outcome }),
      t(outcome === 'complete' ? 'calendar.markedComplete' : 'calendar.markedNoShow'),
    )

  const readOnly = !appointment.canMove && !appointment.canMark
  const footer = appointment.canMove ? (
    // Panel (md+): the full "Annulla appuntamento" on one line, "Sposta" takes the rest.
    <SheetFooter className="grid grid-cols-2 gap-2 md:grid-cols-[auto_minmax(0,1fr)]">
      <Button variant="danger" className="whitespace-nowrap" onClick={() => setMode('cancel')}>
        <XCircle aria-hidden="true" className="size-4 shrink-0" />
        {/* Phones show "Annulla"; the accessible name is always the full action. */}
        <span aria-hidden="true" className="md:hidden">
          {t('calendar.actions.cancelShort')}
        </span>
        <span className="sr-only md:not-sr-only">{t('calendar.actions.cancel')}</span>
      </Button>
      <Button onClick={() => setMode('move')}>
        <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
        {t('calendar.actions.move')}
      </Button>
    </SheetFooter>
  ) : appointment.canMark ? (
    <SheetFooter className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-muted">{t('calendar.details.outcome')}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="success"
          className="min-h-14 px-3"
          loading={mark.isPending && mark.variables?.outcome === 'complete'}
          disabled={mark.isPending}
          onClick={() => markAs('complete')}
        >
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          {t('calendar.actions.complete')}
        </Button>
        <Button
          variant="warning"
          className="min-h-14 px-3"
          loading={mark.isPending && mark.variables?.outcome === 'no-show'}
          disabled={mark.isPending}
          onClick={() => markAs('no-show')}
        >
          <UserX aria-hidden="true" className="size-5 shrink-0" />
          {t('calendar.actions.noShow')}
        </Button>
      </div>
      {appointment.canCancel && (
        <button
          type="button"
          onClick={() => setMode('cancel')}
          className="min-h-11 self-center rounded-control px-3 text-sm font-semibold text-danger underline-offset-4 hover:underline"
        >
          {t('calendar.actions.cancel')}
        </button>
      )}
    </SheetFooter>
  ) : readOnly && onRebook && customerId ? (
    <SheetFooter>
      <Button variant="secondary" className="w-full" onClick={() => onRebook(appointment)}>
        <Plus aria-hidden="true" className="size-4 shrink-0" />
        {t('calendar.details.rebook', { name: firstName })}
      </Button>
    </SheetFooter>
  ) : null

  return (
    <Sheet labelledBy={headingId} onClose={onClose}>
      <div className="flex shrink-0 items-center gap-2 pt-2 pr-3 pl-6 md:pt-4 md:pr-4 md:pl-7">
        <StatusBadge status={appointment.status} />
        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted">
          {appointment.origin === 'Business' ? (
            <Store aria-hidden="true" className="size-3.5 shrink-0" />
          ) : (
            <Globe aria-hidden="true" className="size-3.5 shrink-0" />
          )}
          <span className="truncate">
            {t(
              appointment.origin === 'Business'
                ? 'calendar.details.originBusiness'
                : 'calendar.details.originOnline',
            )}
          </span>
        </span>
        <CloseButton onClose={onClose} className="ml-auto" />
      </div>

      <SheetBody>
        <div>
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className={`font-heading text-[2.125rem] leading-tight font-semibold tracking-tight tabular-nums outline-none md:text-4xl ${cancelled ? 'text-muted line-through' : ''}`}
          >
            {/* Name of the sheet: "Appuntamento 10:15 – 11:00". The space is its own text node:
                inside the span it would be trimmed from the accessible name. */}
            <span className="sr-only">{t('calendar.details.title')}</span>{' '}
            {timeOf(appointment.start)} – {timeOf(appointment.end)}
          </h2>
          <p className="mt-0.5 font-semibold">
            {capitalize(longDate(appointment.start, timeZone))}
          </p>
          <p className="mt-1.5 text-muted">
            {[
              appointment.serviceName,
              formatDuration(durationMinutes),
              formatPrice(appointment.priceCents, appointment.priceIsFrom),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {banner && (
          <div className={`flex gap-2.5 rounded-card p-3 text-sm ${banner.tone}`}>
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              {'title' in banner && <strong className="block">{banner.title}</strong>}
              {banner.text}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Avatar name={staffName} tone="neutral" />
          <p className="flex min-w-0 flex-col">
            <span className="text-sm text-muted">{t('calendar.details.staff')}</span>
            <span className="truncate font-semibold">{staffName}</span>
          </p>
          {bufferMinutes > 0 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-sm text-muted">
              <Clock aria-hidden="true" className="size-3.5" />
              {t('calendar.details.buffer', { minutes: bufferMinutes })}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-card border border-border p-4">
          <div className="flex items-center gap-3">
            <Avatar name={customer} tone="primary" />
            <p className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{customer}</span>
              <span className="text-sm text-muted">
                {t(hasAccount ? 'calendar.details.account' : 'calendar.details.addressBook')}
              </span>
            </p>
            {phone && (
              <a
                href={telHref(phone)}
                aria-label={t('calendar.details.call', { name: customer })}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-primary-text transition-colors hover:bg-primary hover:text-primary-fg"
              >
                <Phone aria-hidden="true" className="size-5" />
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                aria-label={t('calendar.details.email', { name: customer })}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-primary-text transition-colors hover:bg-primary hover:text-primary-fg"
              >
                <Mail aria-hidden="true" className="size-5" />
              </a>
            )}
          </div>
          {(phone || email) && (
            <div className="flex flex-wrap gap-x-4 border-t border-border pt-1 text-sm">
              {phone && (
                <a
                  href={telHref(phone)}
                  className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline"
                >
                  {phone}
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex min-h-11 items-center font-semibold break-all text-primary-text underline-offset-4 hover:underline"
                >
                  {email}
                </a>
              )}
            </div>
          )}
        </div>

        {appointment.customerNote && (
          <div className="rounded-card border border-dashed border-border-strong bg-bg p-3">
            <p className="text-sm font-semibold text-muted">
              {t(
                appointment.origin === 'Business'
                  ? 'calendar.details.noteBusiness'
                  : 'calendar.details.note',
              )}
            </p>
            <p className="mt-1">«{appointment.customerNote}»</p>
          </div>
        )}
      </SheetBody>
      {footer}
    </Sheet>
  )
}
