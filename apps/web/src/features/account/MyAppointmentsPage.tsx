import { CalendarDays, Clock, Phone } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { formatDuration, formatPrice, longDate, timeOf } from '@/lib/format'
import { isApiError } from '@/services/apiClient'
import type { MyAppointment } from '@/types/api'
import { useCancelAppointment, useMyAppointments, type AppointmentScope } from './appointmentsApi'
import { tenantPath } from '@/app/paths'
import { telHref } from '@/lib/tel'

const statusStyle: Record<string, string> = {
  Confirmed: 'bg-primary-soft text-primary-text',
  Completed: 'bg-subtle text-muted',
  CancelledByCustomer: 'bg-subtle text-muted',
  CancelledByBusiness: 'bg-danger-soft text-danger',
  NoShow: 'bg-warning-soft text-warning',
}

const timeZoneOf = (appointment: MyAppointment) => appointment.tenant.timeZone

export default function MyAppointmentsPage() {
  const { t } = useTranslation(['account', 'common'])
  const [scope, setScope] = useState<AppointmentScope>('upcoming')
  const { data, isPending, isError } = useMyAppointments(scope)
  const cancel = useCancelAppointment()
  const [toCancel, setToCancel] = useState<MyAppointment | null>(null)

  const confirmCancel = async () => {
    if (!toCancel) return
    try {
      await cancel.mutateAsync(toCancel.id)
      toast.success(t('cancelled'))
    } catch (error) {
      const code = isApiError(error) ? error.code : null
      toast.error(
        code === 'booking.cancellation_window_passed' || code === 'booking.not_cancellable'
          ? t(`errors.${code}`)
          : t('common:errors.generic'),
      )
    } finally {
      setToCancel(null)
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{t('title')}</h1>

      <div
        role="tablist"
        aria-label={t('title')}
        className="grid grid-cols-2 gap-1 rounded-card bg-subtle p-1"
      >
        {(['upcoming', 'past'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={scope === value}
            onClick={() => setScope(value)}
            className={`min-h-11 rounded-control text-[15px] ${
              scope === value
                ? 'bg-surface font-semibold text-ink shadow-sm'
                : 'font-medium text-muted'
            }`}
          >
            {t(value)}
          </button>
        ))}
      </div>

      {isPending && <PageSpinner />}
      {isError && <p className="text-danger">{t('common:errors.generic')}</p>}
      {data?.length === 0 && (
        <p className="rounded-card border border-border bg-surface p-6 text-center text-muted">
          {scope === 'upcoming' ? t('emptyUpcoming') : t('empty')}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {data?.map((appointment) => (
          <li key={appointment.id}>
            <AppointmentCard appointment={appointment} onCancel={() => setToCancel(appointment)} />
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={toCancel !== null}
        title={t('cancelTitle')}
        confirmLabel={t('cancelConfirm')}
        cancelLabel={t('keep')}
        danger
        loading={cancel.isPending}
        onConfirm={() => void confirmCancel()}
        onClose={() => setToCancel(null)}
      >
        {toCancel &&
          t('cancelText', {
            service: toCancel.serviceName,
            tenant: toCancel.tenant.name,
            when: longDate(toCancel.start, timeZoneOf(toCancel)),
            time: timeOf(toCancel.start),
          })}
      </ConfirmDialog>
    </section>
  )
}

function AppointmentCard({
  appointment,
  onCancel,
}: {
  appointment: MyAppointment
  onCancel: () => void
}) {
  const { t } = useTranslation('account')
  const confirmed = appointment.status === 'Confirmed'
  const price = formatPrice(appointment.priceCents, appointment.priceIsFrom)

  return (
    <article className="flex flex-col gap-3.5 rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            to={tenantPath(appointment.tenant.slug)}
            className="truncate font-semibold hover:underline"
          >
            {appointment.tenant.name}
          </Link>
          {appointment.tenant.address && (
            <span className="truncate text-sm text-muted">{appointment.tenant.address}</span>
          )}
        </div>
        <span
          className={`rounded-pill px-2.5 py-0.5 text-[13px] font-semibold ${statusStyle[appointment.status] ?? ''}`}
        >
          {t(`status.${appointment.status}` as 'status.Confirmed')}
        </span>
      </div>

      <div className="flex flex-col gap-1 rounded-control bg-bg p-3">
        <span className="flex items-center gap-2 font-heading text-lg font-semibold first-letter:uppercase">
          <CalendarDays aria-hidden="true" className="size-[18px] text-muted" />
          {longDate(appointment.start, timeZoneOf(appointment))} · {timeOf(appointment.start)}
        </span>
        <span className="text-sm text-muted">
          {appointment.serviceName} · {formatDuration(appointment.durationMinutes)} ·{' '}
          {appointment.staffName}
          {price && ` · ${price}`}
        </span>
      </div>

      {confirmed && appointment.canCancel && (
        <Button variant="danger" onClick={onCancel}>
          {t('cancel')}
        </Button>
      )}

      {confirmed && !appointment.canCancel && new Date(appointment.start) > new Date() && (
        <p className="flex gap-2 rounded-control bg-warning-soft p-3 text-sm text-warning">
          <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="flex flex-col">
            {t('tooLate', {
              hours: Math.round(
                (new Date(appointment.start).getTime() -
                  new Date(appointment.cancelDeadline).getTime()) /
                  3_600_000,
              ),
            })}
            {appointment.tenant.phone && (
              // Own line and 44 px tall: calling is the only way to cancel at this point.
              <a
                href={telHref(appointment.tenant.phone)}
                className="flex min-h-11 w-fit items-center gap-1.5 font-semibold underline"
              >
                <Phone aria-hidden="true" className="size-4" />
                {appointment.tenant.phone}
              </a>
            )}
          </span>
        </p>
      )}
    </article>
  )
}
