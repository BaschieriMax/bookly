import { addDays } from '@/lib/format'
import type { TimeOff, WorkingInterval } from '@/types/api'

/** Monday first, as in Italian calendars. Values are .NET DayOfWeek (0 = Sunday). */
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const

export interface EditableInterval {
  key: string
  dayOfWeek: number
  start: string
  end: string
}

let nextKey = 0
export const newKey = () => `interval-${++nextKey}`

/** "09:00:00" → "09:00" (what <input type="time"> uses). */
export const hhmm = (time: string) => time.slice(0, 5)

export function toEditable(intervals: WorkingInterval[]): EditableInterval[] {
  return intervals.map((i) => ({
    key: newKey(),
    dayOfWeek: i.dayOfWeek,
    start: hhmm(i.start),
    end: hhmm(i.end),
  }))
}

/** Days whose intervals are invalid: empty times, end not after start, or overlapping. */
export function invalidDays(intervals: EditableInterval[]): Set<number> {
  const invalid = new Set<number>()
  for (const day of WEEK_DAYS) {
    const sorted = intervals
      .filter((i) => i.dayOfWeek === day)
      .sort((a, b) => a.start.localeCompare(b.start))
    sorted.forEach((interval, index) => {
      const previous = sorted[index - 1]
      if (
        !interval.start ||
        !interval.end ||
        interval.end <= interval.start ||
        (previous && previous.end > interval.start)
      ) {
        invalid.add(day)
      }
    })
  }
  return invalid
}

export interface TimeOffPeriod {
  wholeDays: boolean
  startDate: string
  endDate: string
  startTime: string
  endTime: string
}

/**
 * Reads a time off returned by the API (instants with the tenant offset, so the wall-clock
 * fields are already local). Whole days end at 00:00 of the following day.
 */
export function periodOf(timeOff: TimeOff): TimeOffPeriod {
  const startDate = timeOff.start.slice(0, 10)
  const startTime = timeOff.start.slice(11, 16)
  const endDate = timeOff.end.slice(0, 10)
  const endTime = timeOff.end.slice(11, 16)
  const wholeDays = startTime === '00:00' && endTime === '00:00'
  return {
    wholeDays,
    startDate,
    endDate: wholeDays ? addDays(endDate, -1) : endDate,
    startTime,
    endTime,
  }
}
