import { ChevronLeft, ChevronRight, Mail } from 'lucide-react'
import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { SheetBody, SheetFooter } from '@/components/ui/Sheet'
import {
  addDays,
  capitalize,
  compactDate,
  compactDateOfKey,
  fromDateKey,
  longDate,
  todayIn,
  weekdayShortOfKey,
} from '@/lib/format'
import type { AdminAppointment } from '@/types/api'
import { useAdminStaff } from '../adminApi'
import { StepHeader } from './AppointmentParts'
import { useCalendar } from './calendarApi'
import { dateOf, nowMinutesIn, timeOf } from './calendarModel'
import {
  AFTERNOON_FROM,
  STRIP_DAYS,
  freeSlots,
  lengthOf,
  stripStartFor,
  worksOn,
  type MovePreview,
} from './moveModel'
import { toTime } from './newAppointmentModel'

export interface MoveTarget {
  date: string
  time: string
  staffId: string
  /** "ven 28 nov, 15:30" for the confirmation toast. */
  when: string
}

interface MoveAppointmentStepProps {
  appointment: AdminAppointment
  timeZone: string
  canChooseStaff: boolean
  headingId: string
  headingRef: Ref<HTMLHeadingElement>
  submitting: boolean
  onBack: () => void
  onClose: () => void
  onSubmit: (target: MoveTarget) => void
  onPreview?: (preview: MovePreview | null) => void
}

const dayLabel = (key: string) => capitalize(longDate(`${key}T12:00:00Z`, 'UTC'))

const monthOf = (key: string) =>
  new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(fromDateKey(key))

const monthsOf = (from: string, to: string) => {
  const month = new Intl.DateTimeFormat('it-IT', { month: 'long' })
  const [first, last] = [month.format(fromDateKey(from)), month.format(fromDateKey(to))]
  return first === last ? first : `${first} – ${last}`
}

const chip =
  'border border-border bg-surface font-semibold text-ink transition-[background-color,border-color,transform] duration-150 enabled:hover:border-ink/60 enabled:active:scale-[0.97] aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-fg disabled:cursor-not-allowed disabled:opacity-40'

/**
 * "Sposta" step (DEC-044): day, staff member and one of the free times, worked out from that
 * day's calendar. The button says where the appointment goes; the API checks everything again.
 */
export function MoveAppointmentStep({
  appointment,
  timeZone,
  canChooseStaff,
  headingId,
  headingRef,
  submitting,
  onBack,
  onClose,
  onSubmit,
  onPreview,
}: MoveAppointmentStepProps) {
  const { t } = useTranslation('admin')
  const staffLegendId = useId()
  const today = todayIn(timeZone)
  const { data: allStaff = [] } = useAdminStaff()

  // Owners move to anyone offering the service; staff members only within their own diary.
  const eligible = allStaff.filter(
    (s) => s.isActive && s.serviceIds.includes(appointment.serviceId) && (canChooseStaff || s.isMe),
  )
  const [chosenStaffId, setStaffId] = useState(appointment.staffId)
  const staff = eligible.find((s) => s.id === chosenStaffId) ?? eligible[0]
  const staffId = staff?.id ?? appointment.staffId

  const initialDate = dateOf(appointment.start) < today ? today : dateOf(appointment.start)
  const [date, setDate] = useState(initialDate)
  const [stripStart, setStripStart] = useState(stripStartFor(initialDate, today))
  const [time, setTime] = useState<number | null>(null)

  const day = useCalendar({ from: date, to: date, staffId: null, includeCancelled: false })
  // Weekly hours are the same in any range: the previous day's data is enough for the strip.
  const hours = day.data?.workingHours ?? []
  const slots = day.isPlaceholderData
    ? null
    : freeSlots({
        calendar: day.data,
        appointment,
        staffId,
        date,
        notAfterNow: date === today ? nowMinutesIn(timeZone) : null,
      })
  const morning = slots?.filter((m) => m < AFTERNOON_FROM) ?? []
  const afternoon = slots?.filter((m) => m >= AFTERNOON_FROM) ?? []

  const { durationMinutes } = lengthOf(appointment)
  useEffect(() => {
    onPreview?.(
      time === null
        ? null
        : {
            appointmentId: appointment.id,
            staffId,
            date,
            start: time,
            end: time + durationMinutes,
          },
    )
  }, [onPreview, appointment.id, staffId, date, time, durationMinutes])
  useEffect(() => () => onPreview?.(null), [onPreview])

  // Phones scroll the strip: bring the chosen day into view when the step opens.
  const selectedDayRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedDayRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [])

  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(stripStart, i))
  const customerName = appointment.customer.firstName
  const shortWhen =
    time === null
      ? ''
      : `${weekdayShortOfKey(date)} ${fromDateKey(date).getDate()} · ${toTime(time)}`

  const pickDay = (key: string) => {
    setDate(key)
    setTime(null)
  }

  const slotGroup = (label: string, group: number[]) =>
    group.length > 0 && (
      <div role="group" aria-label={label} className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
        <div className="grid grid-cols-4 gap-1.5 md:grid-cols-5">
          {group.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === time}
              onClick={() => setTime(m)}
              className={`h-11 rounded-control text-sm tabular-nums ${chip}`}
            >
              {toTime(m)}
            </button>
          ))}
        </div>
      </div>
    )

  return (
    <>
      <StepHeader
        headingId={headingId}
        headingRef={headingRef}
        title={t('calendar.move.title')}
        onBack={onBack}
        onClose={onClose}
      />
      <SheetBody>
        <p className="text-sm text-muted">
          {appointment.serviceName} · {appointment.customer.firstName}{' '}
          {appointment.customer.lastName} ·{' '}
          {t('calendar.move.now', {
            when: `${compactDate(appointment.start)}, ${timeOf(appointment.start)}`,
          })}
        </p>

        <section className="flex flex-col gap-2" aria-labelledby={`${headingId}-day`}>
          <div className="flex items-center gap-2">
            <h3 id={`${headingId}-day`} className="text-sm font-semibold">
              {t('calendar.move.day')}
            </h3>
            <span className="text-sm text-muted">{monthsOf(days[0]!, days.at(-1)!)}</span>
            <div className="ml-auto flex">
              <button
                type="button"
                aria-label={t('calendar.move.earlier')}
                disabled={stripStart <= today}
                onClick={() => {
                  const earlier = addDays(stripStart, -STRIP_DAYS)
                  setStripStart(earlier < today ? today : earlier)
                }}
                className="inline-flex size-11 items-center justify-center rounded-control text-ink transition-colors enabled:hover:bg-subtle disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </button>
              <button
                type="button"
                aria-label={t('calendar.move.later')}
                onClick={() => setStripStart(addDays(stripStart, STRIP_DAYS))}
                className="inline-flex size-11 items-center justify-center rounded-control text-ink transition-colors hover:bg-subtle"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>
          <div className="-mx-6 flex gap-1.5 overflow-x-auto px-6 pt-0.5 pb-1 md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0">
            {days.map((key) => {
              const closed = hours.length > 0 && !worksOn(hours, staffId, key)
              const selected = key === date
              return (
                <button
                  key={key}
                  ref={selected ? selectedDayRef : undefined}
                  type="button"
                  disabled={closed}
                  aria-pressed={selected}
                  onClick={() => pickDay(key)}
                  className={`flex h-16 w-13 shrink-0 flex-col items-center justify-center gap-0.5 rounded-card md:h-14 md:w-auto ${chip}`}
                >
                  {/* Named by its visible text plus the month: "mar 16 febbraio, chiuso". The
                      spaces are text nodes of their own, or the name would read "mar16". */}
                  <span className="text-xs font-medium first-letter:uppercase">
                    {weekdayShortOfKey(key)}
                  </span>{' '}
                  <span className={`text-base font-bold ${closed ? 'line-through' : ''}`}>
                    {fromDateKey(key).getDate()}
                  </span>{' '}
                  <span className="sr-only">
                    {monthOf(key)}
                    {closed && `, ${t('calendar.move.closed')}`}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {eligible.length > 1 && (
          <fieldset className="flex flex-col gap-2" aria-labelledby={staffLegendId}>
            <legend id={staffLegendId} className="mb-2 text-sm font-semibold">
              {t('calendar.move.staff')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {eligible.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === staffId}
                  onClick={() => {
                    setStaffId(s.id)
                    setTime(null)
                  }}
                  className={`min-h-11 rounded-pill px-4 ${chip}`}
                >
                  {s.displayName}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <section
          className="flex flex-col gap-3"
          aria-labelledby={`${headingId}-slots`}
          aria-busy={slots === null}
        >
          <h3 id={`${headingId}-slots`} className="text-sm font-semibold">
            {t('calendar.move.slots')}{' '}
            <span className="font-normal text-muted">· {dayLabel(date)}</span>
          </h3>
          {slots === null ? (
            <p className="text-sm text-muted">{t('calendar.move.loading')}</p>
          ) : slots.length === 0 ? (
            <p
              role="status"
              className="rounded-card border border-dashed border-border-strong p-4 text-center text-sm text-muted"
            >
              {t('calendar.move.noSlots')}
            </p>
          ) : (
            <>
              {slotGroup(t('calendar.move.morning'), morning)}
              {slotGroup(t('calendar.move.afternoon'), afternoon)}
            </>
          )}
        </section>

        {appointment.customer.email && (
          <p className="flex gap-2 text-sm text-muted">
            <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t('calendar.move.hint', { name: customerName })}
          </p>
        )}
      </SheetBody>
      <SheetFooter className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 md:flex md:justify-end">
        <Button variant="secondary" onClick={onBack}>
          {t('calendar.actions.back')}
        </Button>
        <Button
          loading={submitting}
          disabled={time === null}
          onClick={() =>
            time !== null &&
            onSubmit({
              date,
              time: toTime(time),
              staffId,
              when: `${compactDateOfKey(date)}, ${toTime(time)}`,
            })
          }
        >
          {time === null ? t('calendar.move.pick') : t('calendar.move.submit', { when: shortWhen })}
        </Button>
      </SheetFooter>
    </>
  )
}
