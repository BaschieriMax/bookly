import { describe, expect, it } from 'vitest'
import type { AdminAppointment, Calendar } from '@/types/api'
import { freeSlots, lengthOf, stripStartFor, worksOn } from './moveModel'
import { toTime } from './newAppointmentModel'

const ANNA = 'anna'
const BRUNO = 'bruno'

function appointment(
  id: string,
  staffId: string,
  start: string,
  end: string,
  blockedUntil: string,
  status = 'Confirmed',
): AdminAppointment {
  const at = (time: string) => `2099-03-02T${time}:00+01:00`
  return {
    id,
    staffId,
    start: at(start),
    end: at(end),
    blockedUntil: at(blockedUntil),
    status,
  } as AdminAppointment
}

// The one being moved: 30 minutes + 10 of buffer.
const moving = appointment('moving', ANNA, '10:00', '10:30', '10:40')

// Monday 2 March 2099: Anna works 09:00–11:00 and 15:00–17:30, away 16:00–16:30.
const day: Calendar = {
  timeZone: 'Europe/Rome',
  from: '2099-03-02',
  to: '2099-03-02',
  staff: [],
  workingHours: [
    { staffId: ANNA, dayOfWeek: 1, start: '09:00:00', end: '11:00:00' },
    { staffId: ANNA, dayOfWeek: 1, start: '15:00:00', end: '17:30:00' },
    { staffId: BRUNO, dayOfWeek: 2, start: '09:00:00', end: '10:00:00' },
  ],
  timeOff: [
    {
      id: 't',
      staffId: ANNA,
      start: '2099-03-02T16:00:00+01:00',
      end: '2099-03-02T16:30:00+01:00',
      reason: null,
    },
  ],
  appointments: [
    moving,
    appointment('other', ANNA, '15:00', '15:30', '15:40'),
    appointment('gone', ANNA, '09:00', '09:30', '09:40', 'CancelledByCustomer'),
  ],
}

function slots(overrides: Partial<Parameters<typeof freeSlots>[0]> = {}) {
  const result = freeSlots({
    calendar: day,
    appointment: moving,
    staffId: ANNA,
    date: '2099-03-02',
    notAfterNow: null,
    ...overrides,
  })
  return result === null ? null : result.map(toTime)
}

describe('lengthOf', () => {
  it('keeps the booked duration and buffer, as the API does when moving', () => {
    expect(lengthOf(moving)).toEqual({ durationMinutes: 30, bufferMinutes: 10 })
  })
})

describe('freeSlots', () => {
  it('offers every 15 minutes inside working hours, buffer included', () => {
    expect(slots()).toEqual([
      // 09:00 is free: the cancelled appointment does not block it.
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      // 10:00 is where it already is; 10:15 + 40 min = 10:55, still inside 11:00.
      '10:15',
      // 15:00–15:40 is taken; 15:45–16:25 and 16:00–16:15 overlap the time off.
      '16:30',
      // 16:45 + 40 = 17:25 still fits; 17:00 + 40 is past the end of the day.
      '16:45',
    ])
  })

  it('follows the hours of the chosen staff member and date', () => {
    expect(slots({ staffId: BRUNO })).toEqual([])
    expect(slots({ staffId: BRUNO, date: '2099-03-03' })).toBeNull()
  })

  it('leaves out the past when the date is today', () => {
    expect(slots({ notAfterNow: 9 * 60 + 30 })).toEqual(['09:45', '10:15', '16:30', '16:45'])
  })

  it('waits for the calendar of the date', () => {
    expect(slots({ calendar: undefined })).toBeNull()
    expect(slots({ date: '2099-03-09' })).toBeNull()
  })
})

describe('worksOn', () => {
  it('tells closed weekdays from working ones', () => {
    expect(worksOn(day.workingHours, ANNA, '2099-03-09')).toBe(true) // a Monday
    expect(worksOn(day.workingHours, ANNA, '2099-03-10')).toBe(false)
    expect(worksOn(day.workingHours, BRUNO, '2099-03-10')).toBe(true)
  })
})

describe('stripStartFor', () => {
  it('starts from today unless the date is further than the strip', () => {
    expect(stripStartFor('2026-12-01', '2026-11-25')).toBe('2026-11-25')
    expect(stripStartFor('2026-12-08', '2026-11-25')).toBe('2026-11-25')
    expect(stripStartFor('2026-12-09', '2026-11-25')).toBe('2026-12-09')
  })
})
