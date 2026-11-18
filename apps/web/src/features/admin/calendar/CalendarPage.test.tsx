import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { AdminAppointment, Calendar } from '@/types/api'
import { ownerMe, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

const ANNA = '22222222-2222-4222-8222-222222222222'

function appointment(overrides: Partial<AdminAppointment> = {}): AdminAppointment {
  return {
    id: 'appt-1',
    staffId: ANNA,
    serviceId: '11111111-1111-4111-8111-111111111111',
    serviceName: 'Taglio',
    start: '2099-03-02T10:00:00+01:00',
    end: '2099-03-02T10:30:00+01:00',
    blockedUntil: '2099-03-02T10:40:00+01:00',
    status: 'Confirmed',
    customerNote: 'Sfumatura bassa',
    cancellationReason: null,
    priceCents: 2500,
    priceIsFrom: false,
    customer: {
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario@example.test',
      phone: '333 1234567',
    },
    canMove: true,
    canCancel: true,
    canMark: false,
    ...overrides,
  }
}

function calendar(from: string, to: string, appointments: AdminAppointment[]): Calendar {
  return {
    timeZone: 'Europe/Rome',
    from,
    to,
    staff: [{ id: ANNA, displayName: 'Anna', isActive: true, isMe: false }],
    workingHours: [{ staffId: ANNA, dayOfWeek: 1, start: '09:00:00', end: '13:00:00' }],
    timeOff: [],
    appointments,
  }
}

const asOwner = () => server.use(http.get('/api/auth/me', () => HttpResponse.json(ownerMe)))

describe('CalendarPage', () => {
  it('shows the day, opens an appointment and moves it', async () => {
    asOwner()
    const requested: string[] = []
    let moveBody: unknown = null
    server.use(
      http.get('/api/admin/calendar', ({ request }) => {
        const url = new URL(request.url)
        requested.push(`${url.searchParams.get('from')}..${url.searchParams.get('to')}`)
        return HttpResponse.json(
          calendar(url.searchParams.get('from')!, url.searchParams.get('to')!, [appointment()]),
        )
      }),
      http.post('/api/admin/appointments/:id/move', async ({ request }) => {
        moveBody = await request.json()
        return HttpResponse.json(appointment({ start: '2099-03-02T11:00:00+01:00' }))
      }),
    )
    renderApp('/admin?data=2099-03-02')

    expect(
      await screen.findByRole('heading', { name: /lunedì 2 marzo 2099/i }, { timeout: 5000 }),
    ).toBeInTheDocument()
    // The time grid labels events for screen readers.
    await userEvent.click(
      await screen.findByRole('button', {
        name: /10:00–10:30, Taglio, Mario Rossi, Anna, Confermato/,
      }),
    )
    expect(requested).toContain('2099-03-02..2099-03-02')
    const dialog = await screen.findByRole('dialog', { name: 'Appuntamento' })
    expect(within(dialog).getByRole('link', { name: '333 1234567' })).toHaveAttribute(
      'href',
      'tel:3331234567',
    )
    expect(within(dialog).getByText('Sfumatura bassa')).toBeInTheDocument()
    expect(within(dialog).getByText("Più 10 min di pausa per l'operatore.")).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Completato' })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Sposta' }))
    const moveDialog = await screen.findByRole('dialog', { name: 'Sposta appuntamento' })
    const time = within(moveDialog).getByLabelText('Nuovo orario')
    await userEvent.clear(time)
    await userEvent.type(time, '11:00')
    await userEvent.click(within(moveDialog).getByRole('button', { name: 'Sposta' }))

    expect((await screen.findAllByText('Appuntamento spostato.'))[0]).toBeInTheDocument()
    expect(moveBody).toEqual({ date: '2099-03-02', time: '11:00', staffId: null })
  })

  it('explains a conflict when moving onto another appointment', async () => {
    asOwner()
    server.use(
      http.get('/api/admin/calendar', () =>
        HttpResponse.json(calendar('2099-03-02', '2099-03-02', [appointment()])),
      ),
      http.post('/api/admin/appointments/:id/move', () =>
        HttpResponse.json(
          { title: 'Conflict', status: 409, code: 'booking.slot_unavailable' },
          { status: 409 },
        ),
      ),
    )
    renderApp('/admin?data=2099-03-02')

    await userEvent.click((await screen.findAllByRole('button', { name: /Taglio/ }))[0]!)
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta' }))
    const moveDialog = await screen.findByRole('dialog', { name: 'Sposta appuntamento' })
    await userEvent.click(within(moveDialog).getByRole('button', { name: 'Sposta' }))

    expect(
      (await screen.findAllByText("C'è già un altro appuntamento in quell'orario."))[0],
    ).toBeInTheDocument()
  })

  it('marks a started appointment and cancels with a reason', async () => {
    asOwner()
    const calls: { path: string; body: unknown }[] = []
    server.use(
      http.get('/api/admin/calendar', () =>
        HttpResponse.json(
          calendar('2099-03-02', '2099-03-02', [
            appointment({ canMark: true, canMove: false }),
            appointment({
              id: 'appt-2',
              start: '2099-03-02T11:00:00+01:00',
              end: '2099-03-02T11:30:00+01:00',
              blockedUntil: '2099-03-02T11:40:00+01:00',
              customer: { firstName: 'Luigi', lastName: 'Verdi', email: null, phone: null },
            }),
          ]),
        ),
      ),
      http.post('/api/admin/appointments/:id/:action', async ({ request, params }) => {
        const text = await request.text()
        calls.push({
          path: `${String(params.id)}/${String(params.action)}`,
          body: text ? JSON.parse(text) : null,
        })
        return HttpResponse.json(appointment())
      }),
    )
    renderApp('/admin?data=2099-03-02')

    await userEvent.click(await screen.findByRole('button', { name: /Mario Rossi, Anna/ }))
    let dialog = await screen.findByRole('dialog', { name: 'Appuntamento' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Non presentato' }))
    expect((await screen.findAllByText('Stato aggiornato.'))[0]).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Luigi Verdi, Anna/ }))
    dialog = await screen.findByRole('dialog', { name: 'Appuntamento' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annulla appuntamento' }))
    dialog = await screen.findByRole('dialog', { name: 'Annulla appuntamento' })
    await userEvent.type(within(dialog).getByLabelText(/Motivo/), 'Chiusura')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sì, annulla' }))

    expect((await screen.findAllByText('Appuntamento annullato.'))[0]).toBeInTheDocument()
    expect(calls).toEqual([
      { path: 'appt-1/no-show', body: null },
      { path: 'appt-2/cancel', body: { reason: 'Chiusura' } },
    ])
  })

  it('navigates by week and keeps the state in the URL', async () => {
    asOwner()
    const requested: string[] = []
    server.use(
      http.get('/api/admin/calendar', ({ request }) => {
        const url = new URL(request.url)
        const from = url.searchParams.get('from')!
        const to = url.searchParams.get('to')!
        requested.push(`${from}..${to}`)
        return HttpResponse.json(calendar(from, to, []))
      }),
    )
    const { router } = renderApp('/admin?data=2099-03-04&vista=settimana')

    expect(
      await screen.findByRole('heading', { name: /lun 2 marzo – dom 8 marzo/i }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Successivo' }))

    expect(
      await screen.findByRole('heading', { name: /lun 9 marzo – dom 15 marzo/i }),
    ).toBeInTheDocument()
    expect(requested).toEqual(['2099-03-02..2099-03-08', '2099-03-09..2099-03-15'])
    expect(router.state.location.search).toContain('data=2099-03-11')

    await userEvent.click(screen.getByRole('radio', { name: 'Giorno' }))
    expect(router.state.location.search).not.toContain('vista')
  })
})
