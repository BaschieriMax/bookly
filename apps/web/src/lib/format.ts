/**
 * Formatting helpers. Times are always shown in the tenant's time zone (booking-domain rule 6):
 * the API returns instants with the tenant offset, and Intl formats them in that time zone.
 */

const euro = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2, minimumFractionDigits: 0 })

/** "25 €", "da 100 €" or null when the price is on request. */
export function formatPrice(cents: number | null | undefined, isFrom = false): string | null {
  if (cents === null || cents === undefined) return null
  const value = `${euro.format(cents / 100)} €`
  return isFrom ? `da ${value}` : value
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** "09:45" from "2027-03-02T09:45:00+01:00" (already in the tenant's local time). */
export function timeOf(isoWithOffset: string): string {
  return isoWithOffset.slice(11, 16)
}

/** "martedì 2 marzo" in the tenant's time zone. */
export function longDate(iso: string, timeZone: string, withYear = false): string {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone,
  }).format(new Date(iso))
}

/** yyyy-MM-dd of a calendar Date (its local fields, as DayPicker uses them). */
export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Calendar Date (local noon, DST-safe) for a yyyy-MM-dd key. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, 12)
}

/** Today's yyyy-MM-dd in a time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

/** "mar 2 marzo" for a yyyy-MM-dd key (a calendar date, no time zone involved). */
export function shortDateOfKey(key: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(fromDateKey(key))
}

/**
 * "ven 6 nov" from an instant with the tenant offset ("2026-11-06T16:30:00+01:00"): the date
 * part is already local, so no time zone is involved. The year is added when it is not the
 * current one ("ven 31 gen 2025").
 */
export function compactDate(isoWithOffset: string, now: Date = new Date()): string {
  const date = fromDateKey(isoWithOffset.slice(0, 10))
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date)
}

/** "ven 6 nov, 16:30" (see compactDate). */
export function compactDateTime(isoWithOffset: string, now: Date = new Date()): string {
  return `${compactDate(isoWithOffset, now)}, ${timeOf(isoWithOffset)}`
}

/** "31 gennaio 2025" from an instant with the tenant offset (see compactDate). */
export function fullDate(isoWithOffset: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fromDateKey(isoWithOffset.slice(0, 10)))
}
