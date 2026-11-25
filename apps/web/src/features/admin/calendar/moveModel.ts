import { addDays } from '@/lib/format'
import type { AdminAppointment, Calendar, CalendarHours } from '@/types/api'
import { dateOf, minutesOf, workingIntervals } from './calendarModel'
import { SLOT_STEP, checkSlot, toTime } from './newAppointmentModel'

/**
 * Pure helpers of the "Sposta" step (DEC-044): the free start times of a day for an appointment,
 * so the business picks one instead of typing a time and finding out from an error. They only
 * help: the API checks hours, time off and the overlap constraint again when moving.
 */

/** Where the appointment would go: drawn on the desktop grid while choosing. */
export interface MovePreview {
  appointmentId: string
  staffId: string
  date: string
  /** Minutes since midnight. */
  start: number
  end: number
}

/** Days shown at once in the day strip. */
export const STRIP_DAYS = 14

/** Start times before 13:00 are "Mattina", the others "Pomeriggio". */
export const AFTERNOON_FROM = 13 * 60

export interface FreeSlotInput {
  /** Calendar of the date (any range that contains it). */
  calendar: Calendar | undefined
  appointment: AdminAppointment
  staffId: string
  date: string
  /** Start times up to this one (minutes) are in the past: the date is today. */
  notAfterNow: number | null
}

/** Length and buffer of the appointment as booked: a move keeps both, like the API. */
export function lengthOf(appointment: AdminAppointment) {
  const start = minutesOf(appointment.start)
  const durationMinutes = minutesOf(appointment.end) - start
  return {
    durationMinutes,
    bufferMinutes: minutesOf(appointment.blockedUntil) - start - durationMinutes,
  }
}

/**
 * Free start times (minutes since midnight, every 15 minutes) of a staff member on a date:
 * inside working hours with the buffer, outside time off, not overlapping another confirmed
 * appointment. The current time of the appointment is left out (nothing would change).
 * Null while the calendar does not cover the date yet.
 */
export function freeSlots({
  calendar,
  appointment,
  staffId,
  date,
  notAfterNow,
}: FreeSlotInput): number[] | null {
  if (!calendar || calendar.from > date || calendar.to < date) return null
  const { durationMinutes, bufferMinutes } = lengthOf(appointment)
  const length = durationMinutes + bufferMinutes
  const current =
    dateOf(appointment.start) === date && appointment.staffId === staffId
      ? minutesOf(appointment.start)
      : null

  const slots: number[] = []
  for (const w of workingIntervals(calendar.workingHours, [staffId], date)) {
    const first = Math.ceil(w.start / SLOT_STEP) * SLOT_STEP
    for (let start = first; start + length <= w.end; start += SLOT_STEP) {
      if (start === current || (notAfterNow !== null && start <= notAfterNow)) continue
      const check = checkSlot({
        calendar,
        staffId,
        date,
        time: toTime(start),
        durationMinutes,
        bufferMinutes,
        ignoreId: appointment.id,
      })
      if (!check.clash && !check.outsideHours) slots.push(start)
    }
  }
  return slots
}

/** The staff member works on that weekday (time off is only known once the day is loaded). */
export const worksOn = (hours: readonly CalendarHours[], staffId: string, date: string) =>
  workingIntervals(hours, [staffId], date).length > 0

/** First day of the strip that shows `date`: today, or `date` itself when it is further out. */
export function stripStartFor(date: string, today: string): string {
  return date < addDays(today, STRIP_DAYS) ? today : date
}
