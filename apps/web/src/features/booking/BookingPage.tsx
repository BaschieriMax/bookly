import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Info, Scissors, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { authKeys } from '@/features/auth/authApi'
import { useMe } from '@/features/auth/useMe'
import { useAvailableDays, useServices, useSlots } from '@/features/tenant/tenantApi'
import { useCurrentTenant } from '@/features/tenant/tenantContext'
import { TenantHeader } from '@/features/tenant/TenantHeader'
import {
  addDays,
  dateKey,
  formatDuration,
  formatPrice,
  fromDateKey,
  longDate,
  timeOf,
  todayIn,
} from '@/lib/format'
import { isApiError } from '@/services/apiClient'
import type { MyAppointment, PublicService, PublicTenant } from '@/types/api'
import { useCreateAppointment, useResendConfirmation } from './bookingApi'
import { DatePicker } from './DatePicker'

/**
 * Booking wizard (booking-domain UX): service → staff + day + time → confirm.
 * The whole selection lives in the URL (?servizio&operatore&data&ora), so it survives the
 * login/registration round trip and the browser back button works step by step.
 */
export default function BookingPage() {
  const tenant = useCurrentTenant()
  const { t } = useTranslation('booking')
  const [params, setParams] = useSearchParams()
  const { data: services, isPending } = useServices(tenant.slug)
  const [booked, setBooked] = useState<MyAppointment | null>(null)

  const service = services?.find((s) => s.id === params.get('servizio')) ?? null
  const staffParam = params.get('operatore')
  const staffId = service?.staff.some((s) => s.id === staffParam) ? staffParam : null
  const start = params.get('ora')

  const update = (changes: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace })
  }

  const step = !service ? 1 : !start ? 2 : 3
  const stepLabel = [t('stepService'), t('stepSchedule'), t('stepConfirm')][step - 1]
  const backTo = step === 1 ? `/b/${tenant.slug}` : undefined

  if (booked) {
    return <Success tenant={tenant} appointment={booked} />
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <TenantHeader
        tenant={tenant}
        backTo={backTo ?? `/b/${tenant.slug}/prenota`}
        subtitle={`${t('stepOf', { step })} · ${stepLabel}`}
      />
      <div
        role="progressbar"
        aria-label={stepLabel}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        className="h-[3px] bg-border"
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {isPending && <PageSpinner />}
      {services && step === 1 && (
        <ServiceStep
          services={services}
          onPick={(id) => update({ servizio: id, operatore: null, data: null, ora: null })}
        />
      )}
      {service && step === 2 && (
        <ScheduleStep
          tenant={tenant}
          service={service}
          staffId={staffId}
          date={params.get('data')}
          onChangeService={() => update({ servizio: null, operatore: null, data: null, ora: null })}
          onStaff={(id) => update({ operatore: id, ora: null }, true)}
          onDate={(date) => update({ data: date, ora: null }, true)}
          onContinue={(slot) => update({ ora: slot })}
        />
      )}
      {service && start && step === 3 && (
        <ConfirmStep
          tenant={tenant}
          service={service}
          staffId={staffId}
          start={start}
          onSlotTaken={() => update({ ora: null })}
          onBooked={setBooked}
        />
      )}
    </div>
  )
}

function ServiceStep({
  services,
  onPick,
}: {
  services: PublicService[]
  onPick: (id: string) => void
}) {
  const { t } = useTranslation('booking')
  return (
    <section className="flex flex-col gap-2 px-5 py-6 sm:px-8">
      <h1 className="mb-2 font-tenant-heading text-4xl leading-tight">{t('chooseService')}</h1>
      <ul className="flex flex-col">
        {services.map((service) => (
          <li key={service.id}>
            <button
              type="button"
              onClick={() => onPick(service.id)}
              className="flex min-h-11 w-full items-center gap-3 border-b border-border py-4 text-left"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-lg font-semibold">{service.name}</span>
                <span className="text-[13px] text-muted">
                  {formatDuration(service.durationMinutes)}
                </span>
              </span>
              <span className="text-xl font-semibold whitespace-nowrap text-primary-text">
                {formatPrice(service.priceCents, service.priceIsFrom) ?? t('priceOnRequest')}
              </span>
              <ChevronRight aria-hidden="true" className="size-5 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ServiceSummary({ service, onChange }: { service: PublicService; onChange: () => void }) {
  const { t } = useTranslation('booking')
  const price = formatPrice(service.priceCents, service.priceIsFrom)
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
      <Scissors aria-hidden="true" className="size-5 text-primary-text" />
      <div className="flex flex-1 flex-col">
        <span className="font-semibold">{service.name}</span>
        <span className="text-[15px] text-muted">
          {formatDuration(service.durationMinutes)}
          {price && ` · ${price}`}
        </span>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="min-h-11 px-1 text-[15px] font-semibold text-primary-text"
      >
        {t('change')}
      </button>
    </div>
  )
}

const chipBase = 'min-h-11 rounded-pill border px-4 text-[15px] font-semibold'
const chipOn = 'border-primary bg-primary text-primary-fg'
const chipOff = 'border-border-strong bg-surface text-ink hover:bg-subtle'
const sectionLabel = 'mb-2.5 text-[13px] font-semibold tracking-[0.14em] text-primary-text'

interface ScheduleStepProps {
  tenant: PublicTenant
  service: PublicService
  staffId: string | null
  date: string | null
  onChangeService: () => void
  onStaff: (staffId: string | null) => void
  onDate: (date: string) => void
  onContinue: (start: string) => void
}

function ScheduleStep({
  tenant,
  service,
  staffId,
  date,
  onChangeService,
  onStaff,
  onDate,
  onContinue,
}: ScheduleStepProps) {
  const { t } = useTranslation('booking')
  const today = todayIn(tenant.timeZone)
  const lastDay = addDays(today, tenant.bookingHorizonDays)
  const [month, setMonth] = useState(() => fromDateKey(date ?? today))
  // The chosen time belongs to a (day, staff) pair: changing either clears it without an effect.
  const selectionKey = `${date ?? ''}|${staffId ?? ''}`
  const [selection, setSelection] = useState<{ key: string; slot: string } | null>(null)
  const selectedSlot = selection?.key === selectionKey ? selection.slot : null

  // Days of the visible month inside [today, lastDay]: one request per month.
  const monthStart = dateKey(new Date(month.getFullYear(), month.getMonth(), 1, 12))
  const monthEnd = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0, 12))
  const from = monthStart < today ? today : monthStart
  const to = monthEnd > lastDay ? lastDay : monthEnd
  const days = useAvailableDays(tenant.slug, service.id, staffId, from, to < from ? from : to)
  const slots = useSlots(tenant.slug, service.id, staffId, date)

  const availableDays = useMemo(
    () => new Set(days.data?.days.filter((d) => d.available).map((d) => d.date)),
    [days.data],
  )

  const slotList = slots.data?.slots ?? []

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 px-5 pt-5 pb-36 sm:px-8">
        <ServiceSummary service={service} onChange={onChangeService} />

        <fieldset>
          <legend className={sectionLabel}>{t('staff')}</legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={staffId === null}
              onClick={() => onStaff(null)}
              className={`${chipBase} ${staffId === null ? chipOn : chipOff}`}
            >
              {t('anyStaff')}
            </button>
            {service.staff.map((member) => (
              <button
                key={member.id}
                type="button"
                aria-pressed={staffId === member.id}
                onClick={() => onStaff(member.id)}
                className={`${chipBase} ${staffId === member.id ? chipOn : chipOff}`}
              >
                {member.displayName}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset aria-busy={days.isFetching}>
          <legend className={sectionLabel}>{t('day')}</legend>
          <DatePicker
            selected={date ? fromDateKey(date) : undefined}
            onSelect={(day) => onDate(dateKey(day))}
            month={month}
            onMonthChange={setMonth}
            startMonth={fromDateKey(today)}
            endMonth={fromDateKey(lastDay)}
            disabled={[
              { before: fromDateKey(today) },
              { after: fromDateKey(lastDay) },
              (day: Date) =>
                !days.isPlaceholderData && days.isSuccess && !availableDays.has(dateKey(day)),
            ]}
          />
        </fieldset>

        <section aria-labelledby="times-title" className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 id="times-title" className="text-lg font-semibold">
              {date ? longDate(`${date}T12:00:00Z`, 'UTC') : t('times')}
            </h2>
            {date && slots.isSuccess && (
              <span className="text-[13px] text-muted">
                {t('freeCount', { count: slotList.length })}
              </span>
            )}
          </div>
          {!date && <p className="text-muted">{t('pickDay')}</p>}
          {date && slots.isPending && <PageSpinner />}
          {date && slots.isSuccess && slotList.length === 0 && (
            <p className="text-muted">{t('noTimes')}</p>
          )}
          {slotList.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slotList.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  aria-pressed={selectedSlot === slot.start}
                  onClick={() => setSelection({ key: selectionKey, slot: slot.start })}
                  className={`min-h-12 rounded-control border text-lg font-semibold tabular-nums ${
                    selectedSlot === slot.start ? chipOn : chipOff
                  }`}
                >
                  {timeOf(slot.start)}
                </button>
              ))}
            </div>
          )}
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Info aria-hidden="true" className="size-3.5" />
            {t('timeZoneNote', { timeZone: tenant.timeZone })}
          </p>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg px-5 pt-3 pb-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {selectedSlot ? (
            <Button className="min-h-13 w-full" onClick={() => onContinue(selectedSlot)}>
              {t('continue')}
            </Button>
          ) : (
            <Button variant="secondary" className="min-h-13 w-full" disabled>
              {t('pickTime')}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

interface ConfirmStepProps {
  tenant: PublicTenant
  service: PublicService
  staffId: string | null
  start: string
  onSlotTaken: () => void
  onBooked: (appointment: MyAppointment) => void
}

function ConfirmStep({ tenant, service, staffId, start, onSlotTaken, onBooked }: ConfirmStepProps) {
  const { t } = useTranslation(['booking', 'auth', 'common'])
  const location = useLocation()
  const queryClient = useQueryClient()
  const { data: me, isPending: meLoading } = useMe()
  const create = useCreateAppointment(tenant.slug)
  const resend = useResendConfirmation()
  const [note, setNote] = useState('')

  const staffName =
    service.staff.find((s) => s.id === staffId)?.displayName ?? t('assignedOnConfirm')
  const price = formatPrice(service.priceCents, service.priceIsFrom)
  const end = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tenant.timeZone,
  }).format(new Date(new Date(start).getTime() + service.durationMinutes * 60_000))
  const redirect = encodeURIComponent(`${location.pathname}${location.search}`)

  const submit = async () => {
    try {
      const appointment = await create.mutateAsync({
        serviceId: service.id,
        staffId,
        start,
        note: note.trim() || null,
      })
      onBooked(appointment)
    } catch (error) {
      if (isApiError(error, 409)) {
        toast.error(t('errors.slotTaken'))
        onSlotTaken()
      } else if (isApiError(error, 401)) {
        await queryClient.invalidateQueries({ queryKey: authKeys.me })
      } else if (!isApiError(error, 403)) {
        toast.error(t('common:errors.generic'))
      }
    }
  }

  const emailNotConfirmed =
    (me && !me.emailConfirmed) ||
    (isApiError(create.error, 403) && create.error.code === 'booking.email_not_confirmed')

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 px-5 pt-5 pb-36 sm:px-8">
        <span className={sectionLabel}>{t('summary')}</span>
        <dl className="flex flex-col rounded-card border border-border bg-surface px-4 py-1">
          {[
            [t('service'), `${service.name} · ${formatDuration(service.durationMinutes)}`],
            [t('when'), `${longDate(start, tenant.timeZone)}, ${timeOf(start)} – ${end}`],
            [t('staffLabel'), staffName],
            [t('price'), price ? `${price} · ${t('payInStore')}` : t('priceOnRequest')],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-3 border-b border-border py-3 last:border-b-0"
            >
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-semibold first-letter:uppercase">{value}</dd>
            </div>
          ))}
        </dl>

        {!meLoading && !me && (
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <p>{t('loginToConfirm')}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/login?redirect=${redirect}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control bg-primary px-4 font-semibold text-primary-fg"
              >
                {t('auth:submit')}
              </Link>
              <Link
                to={`/registrati?redirect=${redirect}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control border border-border-strong px-4 font-semibold"
              >
                {t('auth:register')}
              </Link>
            </div>
          </div>
        )}

        {me && (
          <div className="flex items-center gap-3 text-[15px]">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-pill border border-border bg-surface"
            >
              <User className="size-[18px] text-muted" />
            </span>
            <span className="flex flex-1 flex-col">
              <span>
                {t('bookingAs')}{' '}
                <strong>
                  {me.firstName} {me.lastName}
                </strong>
              </span>
              <span className="text-[13px] text-muted">{me.email}</span>
            </span>
          </div>
        )}

        {me && emailNotConfirmed && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-card border border-warning bg-warning-soft p-4 text-warning"
          >
            <p>{t('emailNotConfirmed')}</p>
            {resend.isSuccess ? (
              <p className="font-semibold">{t('emailResent')}</p>
            ) : (
              <Button
                variant="secondary"
                loading={resend.isPending}
                onClick={() => resend.mutate(me.email)}
              >
                {t('resendEmail')}
              </Button>
            )}
          </div>
        )}

        {me && !emailNotConfirmed && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="note" className="text-[15px] font-semibold">
              {t('note')} <span className="font-normal text-muted">{t('optional')}</span>
            </label>
            <textarea
              id="note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('notePlaceholder')}
              aria-describedby="note-hint"
              className="w-full resize-none rounded-control border border-border-strong bg-surface p-3 text-ink"
            />
            <span id="note-hint" className="text-[13px] text-muted">
              {t('noteHint')}
            </span>
          </div>
        )}

        <p className="flex gap-2.5 rounded-card border border-border p-3 text-[15px] text-muted">
          <Info aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-primary-text" />
          {t('cancelPolicy', { hours: tenant.cancellationWindowHours })}
        </p>
      </div>

      {me && !emailNotConfirmed && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg px-5 pt-3 pb-6">
          <div className="mx-auto max-w-3xl">
            <Button
              className="min-h-13 w-full"
              loading={create.isPending}
              onClick={() => void submit()}
            >
              {create.isPending ? t('confirming') : t('confirm')}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function Success({ tenant, appointment }: { tenant: PublicTenant; appointment: MyAppointment }) {
  const { t } = useTranslation('booking')
  return (
    <main
      role="status"
      className="mx-auto flex min-h-screen max-w-md flex-col items-center gap-4 px-6 py-16 text-center"
    >
      <span
        aria-hidden="true"
        className="flex size-18 items-center justify-center rounded-pill bg-primary text-primary-fg"
      >
        <Check className="size-9" strokeWidth={2.5} />
      </span>
      <h1 className="font-tenant-heading text-5xl leading-tight">{t('successTitle')}</h1>
      <p className="text-lg text-muted">
        {t('successText', {
          service: appointment.serviceName,
          when: longDate(appointment.start, tenant.timeZone),
          time: timeOf(appointment.start),
        })}
      </p>
      <Link
        to="/account/appuntamenti"
        className="mt-4 flex min-h-13 w-full items-center justify-center rounded-control bg-primary font-semibold text-primary-fg"
      >
        {t('goToBookings')}
      </Link>
    </main>
  )
}
