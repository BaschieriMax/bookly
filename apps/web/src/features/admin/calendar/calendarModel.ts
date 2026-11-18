import { addDays, fromDateKey } from '@/lib/format'
import type { AdminAppointment, CalendarHours, CalendarTimeOff } from '@/types/api'

/**
 * Pure helpers of the admin calendar. Instants from the API carry the tenant offset, so their
 * "yyyy-MM-dd" and "HH:mm" parts are already the tenant's wall clock (booking-domain rule 6).
 */

export type CalendarView = 'day' | 'week'

export const HOUR_PX = 72
export const DEFAULT_RANGE = { start: 8 * 60, end: 20 * 60 } as const

export const dateOf = (iso: string) => iso.slice(0, 10)
export const timeOf = (iso: string) => iso.slice(11, 16)

/** Minutes since local midnight of an instant with offset, or of "HH:mm[:ss]". */
export function minutesOf(value: string): number {
  const time = value.length > 8 ? value.slice(11, 16) : value.slice(0, 5)
  const [h, m] = time.split(':').map(Number) as [number, number]
  return h * 60 + m
}

/** Monday of the week containing the date (Italian calendars start on Monday). */
export function weekStart(key: string): string {
  const day = fromDateKey(key).getDay() // 0 = Sunday
  return addDays(key, day === 0 ? -6 : 1 - day)
}

export function rangeFor(view: CalendarView, key: string): { from: string; to: string } {
  if (view === 'day') return { from: key, to: key }
  const from = weekStart(key)
  return { from, to: addDays(from, 6) }
}

export function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

export const dayOfWeek = (key: string) => fromDateKey(key).getDay()

export interface Lane {
  lane: number
  lanes: number
}

/**
 * Side-by-side layout of overlapping events (like calendar apps): events that overlap share a
 * cluster and each gets the first free lane. Intervals are half-open, so 10:00–10:30 and
 * 10:30–11:00 do not overlap.
 */
export function layoutLanes(
  events: readonly { id: string; start: number; end: number }[],
): Map<string, Lane> {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end)
  const result = new Map<string, Lane>()
  let cluster: { id: string; lane: number }[] = []
  let laneEnds: number[] = []
  let clusterEnd = -Infinity

  const flush = () => {
    for (const item of cluster) result.set(item.id, { lane: item.lane, lanes: laneEnds.length })
    cluster = []
    laneEnds = []
  }

  for (const event of sorted) {
    if (event.start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= event.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(event.end)
    } else {
      laneEnds[lane] = event.end
    }
    cluster.push({ id: event.id, lane })
    clusterEnd = Math.max(clusterEnd, event.end)
  }
  flush()
  return result
}

/** Visible hours: working hours and appointments of the range, rounded to whole hours. */
export function visibleRange(
  hours: readonly CalendarHours[],
  appointments: readonly AdminAppointment[],
): { start: number; end: number } {
  const starts = [
    ...hours.map((h) => minutesOf(h.start)),
    ...appointments.map((a) => minutesOf(a.start)),
  ]
  const ends = [
    ...hours.map((h) => minutesOf(h.end)),
    ...appointments.map((a) =>
      dateOf(a.end) > dateOf(a.start) ? 24 * 60 : minutesOf(a.blockedUntil),
    ),
  ]
  if (starts.length === 0) return { ...DEFAULT_RANGE }
  const start = Math.floor(Math.min(...starts) / 60) * 60
  const end = Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60)
  return { start, end: Math.max(end, start + 60) }
}

/** Working intervals (minutes) of the given staff on a date, merged when several staff overlap. */
export function workingIntervals(
  hours: readonly CalendarHours[],
  staffIds: readonly string[],
  key: string,
): { start: number; end: number }[] {
  const day = dayOfWeek(key)
  const intervals = hours
    .filter((h) => h.dayOfWeek === day && staffIds.includes(h.staffId))
    .map((h) => ({ start: minutesOf(h.start), end: minutesOf(h.end) }))
    .sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = []
  for (const interval of intervals) {
    const last = merged.at(-1)
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
    else merged.push({ ...interval })
  }
  return merged
}

/** Part of a time off that falls on a date, in minutes (clipped to the day). */
export function timeOffOnDay(
  timeOff: CalendarTimeOff,
  key: string,
): { start: number; end: number } | null {
  const startDay = dateOf(timeOff.start)
  const endDay = dateOf(timeOff.end)
  if (key < startDay || key > endDay) return null
  const start = key === startDay ? minutesOf(timeOff.start) : 0
  const end = key === endDay ? minutesOf(timeOff.end) : 24 * 60
  return end > start ? { start, end } : null
}

/** Current minutes since midnight in a time zone (for the "now" line). */
export function nowMinutesIn(timeZone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

export const isCancelled = (status: string) =>
  status === 'CancelledByCustomer' || status === 'CancelledByBusiness'
