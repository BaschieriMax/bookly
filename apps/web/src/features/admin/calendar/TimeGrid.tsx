import { useTranslation } from 'react-i18next'
import type { AdminAppointment, CalendarHours, CalendarTimeOff } from '@/types/api'
import {
  HOUR_PX,
  layoutLanes,
  minutesOf,
  timeOf,
  timeOffOnDay,
  workingIntervals,
} from './calendarModel'
import { statusBlock, type AppointmentStatus } from './statusStyles'

export interface GridColumn {
  key: string
  /** Header text, e.g. "Anna" (day view) or "lun 2" (week view). */
  label: string
  /** Local date of the column (yyyy-MM-dd). */
  date: string
  staffIds: string[]
  appointments: AdminAppointment[]
  timeOff: CalendarTimeOff[]
  isToday: boolean
}

interface TimeGridProps {
  columns: GridColumn[]
  hours: CalendarHours[]
  range: { start: number; end: number }
  nowMinutes: number
  staffName: (id: string) => string
  onSelect: (appointment: AdminAppointment) => void
}

const px = (minutes: number) => (minutes / 60) * HOUR_PX

/** Time grid (desktop): one column per staff member or per day, events laid out side by side. */
export function TimeGrid({
  columns,
  hours,
  range,
  nowMinutes,
  staffName,
  onSelect,
}: TimeGridProps) {
  const { t } = useTranslation('admin')
  const height = px(range.end - range.start)
  const hourMarks: number[] = []
  for (let m = range.start; m < range.end; m += 60) hourMarks.push(m)

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <div
        className="grid min-w-full"
        style={{ gridTemplateColumns: `4rem repeat(${columns.length}, minmax(9rem, 1fr))` }}
      >
        <div className="sticky top-0 z-20 border-b border-border bg-surface" />
        {columns.map((column) => (
          <div
            key={column.key}
            className={`sticky top-0 z-20 truncate border-b border-l border-border bg-surface px-2 py-3 text-center text-sm font-semibold first-letter:uppercase ${column.isToday ? 'text-primary-text' : ''}`}
          >
            {column.label}
          </div>
        ))}

        <div className="relative" style={{ height }} aria-hidden="true">
          {hourMarks.map((m) => (
            <span
              key={m}
              className="absolute right-2 -translate-y-1/2 text-xs text-muted first:translate-y-0"
              style={{ top: px(m - range.start) }}
            >
              {String(m / 60).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {columns.map((column) => {
          const working = workingIntervals(hours, column.staffIds, column.date)
          const lanes = layoutLanes(
            column.appointments.map((a) => ({
              id: a.id,
              start: minutesOf(a.start),
              end: minutesOf(a.blockedUntil),
            })),
          )
          return (
            <section
              key={column.key}
              aria-label={column.label}
              className="relative border-l border-border bg-subtle"
              style={{ height }}
            >
              {working.map((w) => (
                <div
                  key={`${w.start}-${w.end}`}
                  aria-hidden="true"
                  className="absolute inset-x-0 bg-surface"
                  style={{ top: px(w.start - range.start), height: px(w.end - w.start) }}
                />
              ))}
              {hourMarks.map((m) => (
                <div
                  key={m}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-border"
                  style={{ top: px(m - range.start) }}
                />
              ))}
              {column.timeOff.map((off) => {
                const part = timeOffOnDay(off, column.date)
                if (!part) return null
                const top = Math.max(part.start, range.start)
                const bottom = Math.min(part.end, range.end)
                if (bottom <= top) return null
                return (
                  <div
                    key={off.id}
                    className="absolute inset-x-1 flex items-start justify-center overflow-hidden rounded-control border border-dashed border-border-strong bg-subtle p-1 text-xs font-semibold text-muted"
                    style={{ top: px(top - range.start), height: px(bottom - top) }}
                  >
                    {off.reason
                      ? `${t('calendar.timeOff')} · ${off.reason}`
                      : t('calendar.timeOff')}
                  </div>
                )
              })}
              {column.appointments.map((a) => {
                const start = minutesOf(a.start)
                const end = minutesOf(a.end)
                const blocked = minutesOf(a.blockedUntil)
                const lane = lanes.get(a.id) ?? { lane: 0, lanes: 1 }
                const width = 100 / lane.lanes
                const customer = `${a.customer.firstName} ${a.customer.lastName}`
                return (
                  <div
                    key={a.id}
                    className="absolute z-10 px-0.5"
                    style={{
                      top: px(start - range.start),
                      height: px(blocked - start),
                      left: `${lane.lane * width}%`,
                      width: `${width}%`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(a)}
                      aria-label={t('calendar.appointmentLabel', {
                        start: timeOf(a.start),
                        end: timeOf(a.end),
                        service: a.serviceName,
                        customer,
                        staff: staffName(a.staffId),
                        status: t(`calendar.status.${a.status as AppointmentStatus}`),
                      })}
                      className={`flex w-full flex-col justify-center overflow-hidden rounded-control border-l-4 px-2 py-0.5 text-left text-xs leading-tight shadow-sm hover:brightness-95 ${statusBlock[a.status] ?? statusBlock.Confirmed}`}
                      style={{ height: Math.max(px(end - start), 22) }}
                    >
                      {end - start < 45 ? (
                        <span className="truncate">
                          <span className="font-semibold">
                            {timeOf(a.start)} {a.serviceName}
                          </span>{' '}
                          · {customer}
                        </span>
                      ) : (
                        <>
                          <span className="font-semibold">
                            {timeOf(a.start)} {a.serviceName}
                          </span>
                          <span className="truncate">{customer}</span>
                        </>
                      )}
                    </button>
                    {blocked > end && (
                      <div
                        aria-hidden="true"
                        className="rounded-b-control border-x border-b border-dashed border-border-strong"
                        style={{ height: px(blocked - end) }}
                      />
                    )}
                  </div>
                )
              })}
              {column.isToday && nowMinutes >= range.start && nowMinutes <= range.end && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 z-10 border-t-2 border-danger"
                  style={{ top: px(nowMinutes - range.start) }}
                >
                  <span className="absolute -top-1.5 -left-1.5 size-3 rounded-pill bg-danger" />
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
