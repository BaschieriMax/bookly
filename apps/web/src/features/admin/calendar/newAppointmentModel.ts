import type { Calendar } from '@/types/api'
import { dateOf, isCancelled, minutesOf, timeOffOnDay, workingIntervals } from './calendarModel'

/**
 * Pure helpers of the "new appointment" dialog (DEC-037). They only warn early: the API checks
 * the same rules again (working hours, time off, the overlap constraint in the database).
 */

export const SLOT_STEP = 15
const FIRST_SLOT = 6 * 60
const LAST_SLOT = 22 * 60

export const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Start times offered in the time select, every 15 minutes from 06:00 to 22:00. */
export function timeOptions(): string[] {
  const options: string[] = []
  for (let m = FIRST_SLOT; m <= LAST_SLOT; m += SLOT_STEP) options.push(toTime(m))
  return options
}

/** Rounded up to the next quarter of an hour (and within the offered range). */
export function nextSlot(minutes: number): number {
  const rounded = Math.ceil(minutes / SLOT_STEP) * SLOT_STEP
  return Math.min(Math.max(rounded, FIRST_SLOT), LAST_SLOT)
}

export interface SlotInput {
  calendar: Calendar | undefined
  staffId: string
  date: string
  /** "HH:mm" */
  time: string
  durationMinutes: number
  bufferMinutes: number
}

export interface SlotCheck {
  /** Confirmed appointment the time overlaps (start–end incl. its buffer), in minutes. */
  clash: { start: number; end: number } | null
  /** Outside the staff member's working hours or during time off: needs a confirmation. */
  outsideHours: boolean
}

/**
 * Checks a start time against the calendar of that day. Half-open intervals, buffers included
 * on both sides, as the database constraint does (booking-domain).
 */
export function checkSlot({
  calendar,
  staffId,
  date,
  time,
  durationMinutes,
  bufferMinutes,
}: SlotInput): SlotCheck {
  if (!calendar || calendar.from > date || calendar.to < date) {
    return { clash: null, outsideHours: false }
  }
  const start = minutesOf(time)
  const blockedUntil = start + durationMinutes + bufferMinutes

  const clashing = calendar.appointments.find(
    (a) =>
      a.staffId === staffId &&
      !isCancelled(a.status) &&
      dateOf(a.start) === date &&
      minutesOf(a.start) < blockedUntil &&
      start < minutesOf(a.blockedUntil),
  )

  const inside = workingIntervals(calendar.workingHours, [staffId], date).some(
    (w) => start >= w.start && blockedUntil <= w.end,
  )
  const away = calendar.timeOff
    .filter((off) => off.staffId === staffId)
    .some((off) => {
      const part = timeOffOnDay(off, date)
      return part !== null && part.start < blockedUntil && start < part.end
    })

  return {
    clash: clashing
      ? { start: minutesOf(clashing.start), end: minutesOf(clashing.blockedUntil) }
      : null,
    outsideHours: !inside || away,
  }
}

/** "Mario Rossi" → first/last name; a number → phone. Prefills "Nuovo cliente" from the search. */
export function splitSearch(query: string): { firstName: string; lastName: string; phone: string } {
  const text = query.trim()
  // Only phone characters with at least 6 digits: "Rossi 2" stays a name.
  if (/^\+?[\d\s./()-]+$/.test(text) && (text.match(/\d/g)?.length ?? 0) >= 6) {
    return { firstName: '', lastName: '', phone: text }
  }
  const [first = '', ...rest] = text.split(/\s+/)
  const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
  return { firstName: cap(first), lastName: rest.map(cap).join(' '), phone: '' }
}
