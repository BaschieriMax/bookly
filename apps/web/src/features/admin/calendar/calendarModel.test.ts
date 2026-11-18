import { describe, expect, it } from 'vitest'
import type { AdminAppointment, CalendarHours } from '@/types/api'
import {
  layoutLanes,
  minutesOf,
  nowMinutesIn,
  rangeFor,
  timeOffOnDay,
  visibleRange,
  weekStart,
  workingIntervals,
} from './calendarModel'

const hours = (staffId: string, dayOfWeek: number, start: string, end: string): CalendarHours => ({
  staffId,
  dayOfWeek,
  start: `${start}:00`,
  end: `${end}:00`,
})

describe('calendarModel', () => {
  it('reads local wall-clock minutes from instants with offset and from times', () => {
    expect(minutesOf('2027-03-28T10:30:00+02:00')).toBe(630)
    expect(minutesOf('09:15:00')).toBe(555)
  })

  it('starts weeks on Monday', () => {
    expect(weekStart('2027-03-07')).toBe('2027-03-01') // Sunday
    expect(weekStart('2027-03-01')).toBe('2027-03-01')
    expect(rangeFor('week', '2027-03-03')).toEqual({ from: '2027-03-01', to: '2027-03-07' })
    expect(rangeFor('day', '2027-03-03')).toEqual({ from: '2027-03-03', to: '2027-03-03' })
  })

  it('puts overlapping events side by side and reuses free lanes', () => {
    const lanes = layoutLanes([
      { id: 'a', start: 600, end: 660 },
      { id: 'b', start: 615, end: 645 },
      { id: 'c', start: 650, end: 700 },
      { id: 'd', start: 700, end: 730 }, // touches c: new cluster
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(lanes.get('b')).toEqual({ lane: 1, lanes: 2 })
    expect(lanes.get('c')).toEqual({ lane: 1, lanes: 2 })
    expect(lanes.get('d')).toEqual({ lane: 0, lanes: 1 })
  })

  it('merges working hours of several staff and computes the visible range', () => {
    const all = [
      hours('a', 2, '09:00', '13:00'),
      hours('b', 2, '12:00', '19:30'),
      hours('a', 3, '07:00', '08:00'),
    ]
    expect(workingIntervals(all, ['a', 'b'], '2027-03-02')).toEqual([{ start: 540, end: 1170 }])
    expect(workingIntervals(all, ['a'], '2027-03-02')).toEqual([{ start: 540, end: 780 }])
    expect(visibleRange(all.slice(0, 2), [])).toEqual({ start: 540, end: 1200 })
    expect(visibleRange([], [])).toEqual({ start: 480, end: 1200 })

    const late = {
      start: '2027-03-02T20:15:00+01:00',
      end: '2027-03-02T20:45:00+01:00',
      blockedUntil: '2027-03-02T21:00:00+01:00',
    } as AdminAppointment
    expect(visibleRange(all.slice(0, 1), [late])).toEqual({ start: 540, end: 1260 })
  })

  it('clips multi-day time off to each day', () => {
    const off = {
      id: 'x',
      staffId: 'a',
      start: '2027-03-02T15:00:00+01:00',
      end: '2027-03-04T12:00:00+01:00',
      reason: null,
    }
    expect(timeOffOnDay(off, '2027-03-01')).toBeNull()
    expect(timeOffOnDay(off, '2027-03-02')).toEqual({ start: 900, end: 1440 })
    expect(timeOffOnDay(off, '2027-03-03')).toEqual({ start: 0, end: 1440 })
    expect(timeOffOnDay(off, '2027-03-04')).toEqual({ start: 0, end: 720 })
  })

  it('computes the current time in the tenant time zone', () => {
    expect(nowMinutesIn('Europe/Rome', new Date('2027-03-01T07:05:00Z'))).toBe(485)
  })
})
