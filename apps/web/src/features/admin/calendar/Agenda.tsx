import { useTranslation } from 'react-i18next'
import { shortDateOfKey } from '@/lib/format'
import type { AdminAppointment, CalendarTimeOff } from '@/types/api'
import { dateOf, timeOf, timeOffOnDay } from './calendarModel'
import { StatusBadge } from './StatusBadge'

interface AgendaProps {
  days: string[]
  appointments: AdminAppointment[]
  timeOff: CalendarTimeOff[]
  staffName: (id: string) => string
  showStaff: boolean
  onSelect: (appointment: AdminAppointment) => void
}

/** List view used on phones: one section per day, appointments in time order. */
export function Agenda({
  days,
  appointments,
  timeOff,
  staffName,
  showStaff,
  onSelect,
}: AgendaProps) {
  const { t } = useTranslation('admin')

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => {
        const items = appointments.filter((a) => dateOf(a.start) === day)
        const offs = timeOff.filter((off) => timeOffOnDay(off, day))
        return (
          <section key={day} aria-label={shortDateOfKey(day)} className="flex flex-col gap-2">
            {days.length > 1 && (
              <h2 className="text-sm font-semibold text-muted first-letter:uppercase">
                {shortDateOfKey(day)}
              </h2>
            )}
            {offs.map((off) => (
              <p
                key={off.id}
                className="rounded-control border border-dashed border-border-strong px-3 py-2 text-sm text-muted"
              >
                {t('calendar.timeOff')} · {staffName(off.staffId)}
                {off.reason ? ` · ${off.reason}` : ''}
              </p>
            ))}
            {items.length === 0 && offs.length === 0 && (
              <p className="text-sm text-muted">{t('calendar.empty')}</p>
            )}
            <ul className="flex flex-col gap-2">
              {items.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(a)}
                    className="flex w-full items-start gap-3 rounded-card border border-border bg-surface p-3 text-left transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
                  >
                    <span className="w-14 shrink-0 pt-0.5 font-semibold tabular-nums">
                      {timeOf(a.start)}
                      <span className="block text-xs font-normal text-muted">{timeOf(a.end)}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-semibold">{a.serviceName}</span>
                      <span className="truncate text-sm text-muted">
                        {a.customer.firstName} {a.customer.lastName}
                        {showStaff && ` · ${staffName(a.staffId)}`}
                      </span>
                      <span className="self-start">
                        <StatusBadge status={a.status} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
