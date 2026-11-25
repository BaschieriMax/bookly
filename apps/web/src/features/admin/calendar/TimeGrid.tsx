import { useState, type MouseEvent as ReactMouseEvent } from 'react'
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
import type { MovePreview } from './moveModel'
import { SLOT_STEP, toTime } from './newAppointmentModel'
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
  /** Draws the "now" line. */
  isToday: boolean
  /** Header in the brand color: today's column of the week view. */
  highlight: boolean
}

interface TimeGridProps {
  columns: GridColumn[]
  hours: CalendarHours[]
  range: { start: number; end: number }
  nowMinutes: number
  staffName: (id: string) => string
  onSelect: (appointment: AdminAppointment) => void
  /** Click on free space: start a new appointment there (minutes since midnight, 15-minute steps). */
  onCreateAt?: (column: GridColumn, minutes: number) => void
  /** Whether a slot accepts a new appointment (not in the past): only those show the hover preview. */
  canCreateAt?: (column: GridColumn, minutes: number) => boolean
  /** Appointment open in the details panel: outlined, so it is clear which one it is. */
  selectedId?: string | null
  /** New time chosen in the "Sposta" step, drawn where it would go (DEC-044). */
  preview?: MovePreview | null
}

const px = (minutes: number) => (minutes / 60) * HOUR_PX

/** The appointment being moved: dashed where it is now, text still readable (not faded). */
const MOVING_BLOCK = 'border-dashed border-border-strong bg-surface text-muted'

/** Slot (15-minute steps) under the pointer, in minutes since midnight. */
function slotAt(event: ReactMouseEvent<HTMLElement>, rangeStart: number): number {
  const offset = event.clientY - event.currentTarget.getBoundingClientRect().top
  const minutes = rangeStart + (offset / HOUR_PX) * 60
  return Math.floor(minutes / SLOT_STEP) * SLOT_STEP
}

/** Time grid (desktop): one column per staff member or per day, events laid out side by side. */
export function TimeGrid({
  columns,
  hours,
  range,
  nowMinutes,
  staffName,
  onSelect,
  onCreateAt,
  canCreateAt = () => true,
  selectedId = null,
  preview = null,
}: TimeGridProps) {
  const { t } = useTranslation('admin')
  // Slot under the pointer: a dashed "+ 10:30" box shows where a click creates the appointment.
  const [hover, setHover] = useState<{ column: string; minutes: number } | null>(null)
  const height = px(range.end - range.start)
  const hourMarks: number[] = []
  for (let m = range.start; m < range.end; m += 60) hourMarks.push(m)

  return (
    // data-time-grid: the blocks are sized by duration (a time scale), so the responsive E2E
    // spec exempts them from the touch-target check; on phones the agenda list is used instead.
    <div data-time-grid className="overflow-x-auto rounded-card border border-border bg-surface">
      <div
        className="grid min-w-full"
        // A week (7 days) fits from 1024 px with the sidebar; staff columns keep more room.
        style={{
          gridTemplateColumns: `4rem repeat(${columns.length}, minmax(${columns.length > 4 ? 6 : 9}rem, 1fr))`,
        }}
      >
        <div className="sticky top-0 z-20 border-b border-border bg-surface" />
        {columns.map((column) => (
          <div
            key={column.key}
            className={`sticky top-0 z-20 truncate border-b border-l border-border bg-surface px-1 py-3 text-center text-sm font-semibold first-letter:uppercase ${column.highlight ? 'text-primary-text' : ''}`}
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
              {onCreateAt && (
                // Pointer shortcut only: keyboard and screen-reader users have the
                // "Nuovo appuntamento" button, so this layer stays out of the tab order.
                <div
                  aria-hidden="true"
                  className={`absolute inset-0 ${hover?.column === column.key ? 'cursor-pointer' : ''}`}
                  onMouseMove={(event) => {
                    const minutes = slotAt(event, range.start)
                    const next = canCreateAt(column, minutes)
                      ? { column: column.key, minutes }
                      : null
                    if (next?.column !== hover?.column || next?.minutes !== hover?.minutes) {
                      setHover(next)
                    }
                  }}
                  onMouseLeave={() => setHover(null)}
                  onClick={(event) => onCreateAt(column, slotAt(event, range.start))}
                />
              )}
              {hover?.column === column.key && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1 z-[5] flex items-start gap-1 rounded-control border-[1.5px] border-dashed border-primary bg-primary-soft/90 px-2 py-1 text-xs font-semibold text-primary-text"
                  style={{
                    top: px(hover.minutes - range.start),
                    height: Math.min(px(SLOT_STEP * 2), px(range.end - hover.minutes)),
                  }}
                >
                  + {toTime(hover.minutes)}
                </div>
              )}
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
                const moving = preview?.appointmentId === a.id
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
                      className={`flex w-full flex-col justify-center overflow-hidden rounded-control border-l-4 px-2 py-0.5 text-left text-xs leading-tight shadow-sm transition-[filter,box-shadow] hover:shadow-md hover:brightness-95 ${moving ? MOVING_BLOCK : (statusBlock[a.status] ?? statusBlock.Confirmed)} ${a.id === selectedId ? 'ring-2 ring-primary' : ''}`}
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
                      {/* Visible text first, details for screen readers (WCAG 2.5.3 label in name). */}
                      <span className="sr-only">
                        {', '}
                        {t('calendar.appointmentDetails', {
                          end: timeOf(a.end),
                          staff: staffName(a.staffId),
                          status: t(`calendar.status.${a.status as AppointmentStatus}`),
                        })}
                      </span>
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
              {preview &&
                preview.date === column.date &&
                column.staffIds.includes(preview.staffId) &&
                preview.start < range.end && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 z-[15] flex animate-fade-in flex-col justify-center overflow-hidden rounded-control border-l-4 border-primary bg-surface px-2 py-0.5 text-xs leading-tight font-semibold text-primary-text shadow-md ring-2 ring-primary"
                    style={{
                      top: px(Math.max(preview.start, range.start) - range.start),
                      height: Math.max(px(preview.end - preview.start), 22),
                    }}
                  >
                    {toTime(preview.start)} · {t('calendar.move.preview')}
                  </div>
                )}
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
