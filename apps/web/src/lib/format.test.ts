import { describe, expect, it } from 'vitest'
import {
  addDays,
  capitalize,
  compactDateOfKey,
  compactDate,
  compactDateTime,
  dateKey,
  formatDuration,
  fullDate,
  formatPrice,
  fromDateKey,
  longDate,
  timeOf,
  todayIn,
  weekdayShortOfKey,
  weekRangeLabel,
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

  it('writes compact dates from the local part of an instant, with the year only when needed', () => {
    const now = new Date(2026, 10, 20)
    // 23:30 local on 31 January: the date stays the local one whatever the browser zone.
    expect(compactDate('2026-11-06T23:30:00+01:00', now)).toBe('ven 6 nov')
    expect(compactDateTime('2025-01-31T16:30:00+01:00', now)).toBe('ven 31 gen 2025, 16:30')
    expect(fullDate('2025-01-31T00:15:00+01:00')).toBe('31 gennaio 2025')
  })

  it('writes compact week labels for the phone calendar', () => {
    expect(weekRangeLabel('2099-03-02', '2099-03-08')).toBe('2 – 8 mar')
    expect(compactDateOfKey('2099-03-02')).toBe('lun 2 mar')
    expect(weekRangeLabel('2099-03-30', '2099-04-05')).toBe('30 mar – 5 apr')
    expect(weekdayShortOfKey('2099-03-30')).toBe('lun')
    expect(capitalize('martedì 3 marzo')).toBe('Martedì 3 marzo')
  })
})
