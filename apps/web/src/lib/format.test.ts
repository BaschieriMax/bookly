import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateKey,
  formatDuration,
  formatPrice,
  fromDateKey,
  longDate,
  timeOf,
  todayIn,
} from './format'

describe('format', () => {
  it('formats prices the Italian way', () => {
    expect(formatPrice(2500)).toBe('25 €')
    expect(formatPrice(10000, true)).toBe('da 100 €')
    expect(formatPrice(1250)).toBe('12,5 €')
    expect(formatPrice(null)).toBeNull()
  })

  it('formats durations', () => {
    expect(formatDuration(30)).toBe('30 min')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
  })

  it('keeps the tenant local time of an instant', () => {
    expect(timeOf('2027-03-02T09:45:00+01:00')).toBe('09:45')
    expect(longDate('2027-03-02T09:45:00+01:00', 'Europe/Rome')).toBe('martedì 2 marzo')
  })

  it('computes today in the tenant time zone, not the browser one', () => {
    // 23:30 UTC on 1 March is already 2 March in Rome.
    expect(todayIn('Europe/Rome', new Date('2027-03-01T23:30:00Z'))).toBe('2027-03-02')
  })

  it('round-trips calendar dates', () => {
    expect(dateKey(fromDateKey('2027-03-28'))).toBe('2027-03-28')
    expect(addDays('2027-03-31', 1)).toBe('2027-04-01')
  })
})
