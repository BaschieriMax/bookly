import { describe, expect, it } from 'vitest'
import type { AdminAppointment, Calendar } from '@/types/api'
import { checkSlot, nextSlot, splitSearch, timeOptions, toTime } from './newAppointmentModel'

const ANNA = 'anna'
const BRUNO = 'bruno'

function appointment(staffId: string, start: string, blockedUntil: string, status = 'Confirmed') {
  return {
    staffId,
    start: `2099-03-02T${start}:00+01:00`,
    blockedUntil: `2099-03-02T${blockedUntil}:00+01:00`,
    status,
  } as AdminAppointment
}

// Monday 2 March 2099: Anna works 09:00–13:00 and 14:00–19:00, away 16:00–17:00.
const day: Calendar = {
  timeZone: 'Europe/Rome',
  from: '2099-03-02',
  to: '2099-03-02',
  staff: [],
  workingHours: [
    { staffId: ANNA, dayOfWeek: 1, start: '09:00:00', end: '13:00:00' },
    { staffId: ANNA, dayOfWeek: 1, start: '14:00:00', end: '19:00:00' },
  ],
  timeOff: [
    {
      id: 't',
      staffId: ANNA,
      start: '2099-03-02T16:00:00+01:00',
      end: '2099-03-02T17:00:00+01:00',
      reason: null,
    },
  ],
  appointments: [
    appointment(ANNA, '10:00', '10:40'),
    appointment(ANNA, '11:00', '11:30', 'CancelledByCustomer'),
    appointment(BRUNO, '12:00', '12:30'),
  ],
}

const check = (time: string, staffId = ANNA, date = '2099-03-02') =>
  checkSlot({ calendar: day, staffId, date, time, durationMinutes: 30, bufferMinutes: 10 })

describe('checkSlot', () => {
  it('flags an overlap with a confirmed appointment, buffers included', () => {
    expect(check('09:30').clash).toEqual({ start: 600, end: 640 }) // 09:30–10:10 hits 10:00
    expect(check('10:30').clash).toEqual({ start: 600, end: 640 }) // the buffer until 10:40
    expect(check('10:40').clash).toBeNull() // half-open intervals
  })

  it('ignores cancelled appointments and other staff members', () => {
    expect(check('11:00').clash).toBeNull()
    expect(check('12:00').clash).toBeNull()
  })

  it('flags times outside the working hours or during time off', () => {
    expect(check('09:00').outsideHours).toBe(false)
    expect(check('12:30').outsideHours).toBe(true) // the buffer ends after 13:00
    expect(check('08:30').outsideHours).toBe(true)
    expect(check('15:45').outsideHours).toBe(true) // runs into the absence
    expect(check('17:00').outsideHours).toBe(false)
    expect(check('09:00', BRUNO).outsideHours).toBe(true) // no hours at all
  })

  it('stays silent when the calendar does not cover the date', () => {
    expect(check('10:00', ANNA, '2099-03-03')).toEqual({ clash: null, outsideHours: false })
    expect(
      checkSlot({
        calendar: undefined,
        staffId: ANNA,
        date: '2099-03-02',
        time: '10:00',
        durationMinutes: 30,
        bufferMinutes: 0,
      }),
    ).toEqual({ clash: null, outsideHours: false })
  })
})

describe('time helpers', () => {
  it('offers quarters of an hour from 06:00 to 22:00', () => {
    const options = timeOptions()
    expect(options[0]).toBe('06:00')
    expect(options.at(-1)).toBe('22:00')
    expect(options).toHaveLength(65)
  })

  it('rounds up to the next quarter within the range', () => {
    expect(nextSlot(9 * 60 + 1)).toBe(9 * 60 + 15)
    expect(nextSlot(9 * 60)).toBe(9 * 60)
    expect(nextSlot(2 * 60)).toBe(6 * 60)
    expect(nextSlot(23 * 60)).toBe(22 * 60)
    expect(toTime(9 * 60 + 5)).toBe('09:05')
  })
})

describe('splitSearch', () => {
  it('turns the search text into a new customer', () => {
    expect(splitSearch('giulia de rossi')).toEqual({
      firstName: 'Giulia',
      lastName: 'De Rossi',
      phone: '',
    })
    expect(splitSearch(' 347 222 3344 ')).toEqual({
      firstName: '',
      lastName: '',
      phone: '347 222 3344',
    })
    expect(splitSearch('')).toEqual({ firstName: '', lastName: '', phone: '' })
    expect(splitSearch('anna room101 402')).toEqual({
      firstName: 'Anna',
      lastName: 'Room101 402',
      phone: '',
    })
  })
})
