import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { AdminAppointment, Calendar } from '@/types/api'
import { adminStaff, ownerMe, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

const ANNA = '22222222-2222-4222-8222-222222222222'
const LUCA = '33333333-3333-4333-8333-333333333333'

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
    origin: 'Online',
    customerNote: 'Sfumatura bassa',
    cancellationReason: null,
    priceCents: 2500,
    priceIsFrom: false,
    customer: {
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario@example.test',
      phone: '333 1234567',
      hasAccount: true,
      id: 'acct-mario',
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
        name: /10:00 Taglio · Mario Rossi, fino alle 10:30, Anna, Confermato/,
      }),
    )
    expect(requested).toContain('2099-03-02..2099-03-02')
    const dialog = await screen.findByRole('dialog', { name: 'Appuntamento 10:00 – 10:30' })
    expect(within(dialog).getByRole('link', { name: '333 1234567' })).toHaveAttribute(
      'href',
      'tel:3331234567',
    )
    expect(within(dialog).getByRole('link', { name: 'Chiama Mario Rossi' })).toBeInTheDocument()
    expect(within(dialog).getByText('«Sfumatura bassa»')).toBeInTheDocument()
    expect(within(dialog).getByText('+10 min di pausa')).toBeInTheDocument()
    expect(within(dialog).getByText('Taglio · 30 min · 25 €')).toBeInTheDocument()
    // A future appointment is moved or cancelled, not marked (DEC-044).
    expect(within(dialog).queryByRole('button', { name: 'Completato' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Annulla appuntamento' })).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Sposta' }))
    expect(dialog).toHaveAccessibleName('Sposta appuntamento')
    expect(within(dialog).getByRole('heading', { name: 'Sposta appuntamento' })).toHaveFocus()
    // Days without working hours cannot be picked.
    expect(within(dialog).getByRole('button', { name: 'lun 2 marzo' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(dialog).getByRole('button', { name: 'mar 3 marzo, chiuso' })).toBeDisabled()

    // Free times only: inside 09:00–13:00 with the 10-minute buffer, not the current 10:00.
    const morning = await within(dialog).findByRole('group', { name: 'Mattina' })
    const times = within(morning)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(times[0]).toBe('09:00')
    expect(times).not.toContain('10:00')
    expect(times.at(-1)).toBe('12:15')
    const submit = within(dialog).getByRole('button', { name: 'Scegli un orario' })
    expect(submit).toBeDisabled()

    await userEvent.click(within(morning).getByRole('button', { name: '11:00' }))
    // The desktop grid shows where it would go.
    expect(screen.getByText('11:00 · Nuovo orario')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sposta a lun 2 · 11:00' }))

    expect(
      (await screen.findAllByText('Appuntamento spostato a lun 2 mar, 11:00.'))[0],
    ).toBeInTheDocument()
    expect(moveBody).toEqual({ date: '2099-03-02', time: '11:00', staffId: null })
    expect(screen.queryByText('11:00 · Nuovo orario')).not.toBeInTheDocument()
  })

  it('moves to another staff member who offers the service', async () => {
    asOwner()
    let moveBody: unknown = null
    server.use(
      http.get('/api/admin/staff', () =>
        HttpResponse.json([
          ...adminStaff,
          { ...adminStaff[0]!, id: LUCA, displayName: 'Luca', sortOrder: 2 },
          { ...adminStaff[0]!, id: 'other', displayName: 'Senza taglio', serviceIds: [] },
        ]),
      ),
      http.get('/api/admin/calendar', ({ request }) => {
        const url = new URL(request.url)
        const result = calendar(url.searchParams.get('from')!, url.searchParams.get('to')!, [
          appointment(),
        ])
        return HttpResponse.json({
          ...result,
          workingHours: [
            ...result.workingHours,
            { staffId: LUCA, dayOfWeek: 1, start: '15:00:00', end: '18:00:00' },
          ],
        })
      }),
      http.post('/api/admin/appointments/:id/move', async ({ request }) => {
        moveBody = await request.json()
        return HttpResponse.json(appointment())
      }),
    )
    renderApp('/admin?data=2099-03-02')

    await userEvent.click((await screen.findAllByRole('button', { name: /Taglio/ }))[0]!)
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta' }))
    const dialog = screen.getByRole('dialog', { name: 'Sposta appuntamento' })
    const staff = await within(dialog).findByRole('group', { name: 'Operatore' })
    expect(
      within(staff)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Barbiere 1', 'Luca'])

    await userEvent.click(within(dialog).getByRole('button', { name: '09:00' }))
    await userEvent.click(within(staff).getByRole('button', { name: 'Luca' }))
    // Another staff member: the chosen time is cleared and the afternoon hours are offered.
    expect(within(dialog).getByRole('button', { name: 'Scegli un orario' })).toBeDisabled()
    expect(within(dialog).queryByRole('group', { name: 'Mattina' })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '15:30' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sposta a lun 2 · 15:30' }))

    await screen.findAllByText('Appuntamento spostato a lun 2 mar, 15:30.')
    expect(moveBody).toEqual({ date: '2099-03-02', time: '15:30', staffId: LUCA })
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
    await userEvent.click(await within(moveDialog).findByRole('button', { name: '11:00' }))
    await userEvent.click(within(moveDialog).getByRole('button', { name: /Sposta a/ }))

    expect(
      (await screen.findAllByText("C'è già un altro appuntamento in quell'orario."))[0],
    ).toBeInTheDocument()
    // The step stays open to pick another time.
    expect(screen.getByRole('dialog', { name: 'Sposta appuntamento' })).toBeInTheDocument()
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
              customer: {
                firstName: 'Luigi',
                lastName: 'Verdi',
                email: null,
                phone: null,
                hasAccount: true,
                id: 'acct-luigi',
              },
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

    await userEvent.click(
      await screen.findByRole('button', { name: /Mario Rossi, fino alle .*, Anna/ }),
    )
    let dialog = await screen.findByRole('dialog', { name: /^Appuntamento/ })
    // Started: "Com'è andata?" instead of moving it (DEC-044).
    expect(within(dialog).getByText('È iniziato alle 10:00')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Sposta' })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Non presentato' }))
    expect((await screen.findAllByText('Segnato come non presentato.'))[0]).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Luigi Verdi, fino alle .*, Anna/ }))
    dialog = await screen.findByRole('dialog', { name: /^Appuntamento/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annulla appuntamento' }))
    expect(dialog).toHaveAccessibleName('Annulla appuntamento')
    // No email address: no promise of an email.
    expect(within(dialog).getByText(/L'annullamento non si può revocare/)).not.toHaveTextContent(
      'email',
    )
    const reason = within(dialog).getByLabelText(/Motivo/)
    await userEvent.type(reason, 'Chiusura')
    // A frequent reason replaces what was typed.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Operatore assente' }))
    expect(reason).toHaveValue('Operatore assente.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sì, annulla' }))

    expect((await screen.findAllByText('Appuntamento annullato.'))[0]).toBeInTheDocument()
    expect(calls).toEqual([
      { path: 'appt-1/no-show', body: null },
      { path: 'appt-2/cancel', body: { reason: 'Operatore assente.' } },
    ])
  })

  it('shows a closed appointment read only and books it again for the same customer', async () => {
    asOwner()
    server.use(
      http.get('/api/admin/calendar', ({ request }) => {
        const url = new URL(request.url)
        return HttpResponse.json(
          calendar(url.searchParams.get('from')!, url.searchParams.get('to')!, [
            appointment({
              status: 'Completed',
              canMove: false,
              canCancel: false,
              canMark: false,
            }),
          ]),
        )
      }),
    )
    renderApp('/admin?data=2099-03-02')

    await userEvent.click((await screen.findAllByRole('button', { name: /Taglio/ }))[0]!)
    const dialog = await screen.findByRole('dialog', { name: /^Appuntamento/ })
    expect(within(dialog).getByText('Il servizio è stato svolto.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Sposta' })).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Annulla appuntamento' }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Prenota di nuovo per Mario' }),
    )

    const created = await screen.findByRole('dialog', { name: 'Nuovo appuntamento' })
    expect(
      await within(created).findByRole('button', { name: /Mario Rossi/, pressed: true }),
    ).toBeInTheDocument()
    expect(within(created).getByLabelText('Servizio')).toHaveValue(
      '11111111-1111-4111-8111-111111111111',
    )
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

  it('applies the filters from the sheet and removes them from the chips (DEC-041)', async () => {
    asOwner()
    const requested: string[] = []
    server.use(
      http.get('/api/admin/staff', () =>
        HttpResponse.json([
          ...adminStaff,
          { ...adminStaff[0]!, id: LUCA, displayName: 'Luca', sortOrder: 2 },
        ]),
      ),
      http.get('/api/admin/calendar', ({ request }) => {
        const url = new URL(request.url)
        requested.push(url.search)
        return HttpResponse.json(calendar('2099-03-02', '2099-03-02', []))
      }),
    )
    const { router } = renderApp('/admin?data=2099-03-02')

    // Nothing changes on the calendar until "Applica".
    await userEvent.click(await screen.findByRole('button', { name: 'Filtri' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtri' })
    await userEvent.selectOptions(within(sheet).getByLabelText('Operatore'), 'Luca')
    await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Mostra annullati' }))
    expect(router.state.location.search).not.toContain('operatore')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Applica' }))

    expect(screen.queryByRole('dialog', { name: 'Filtri' })).not.toBeInTheDocument()
    expect(router.state.location.search).toContain(`operatore=${LUCA}`)
    expect(router.state.location.search).toContain('annullati=1')
    expect(screen.getByRole('button', { name: 'Filtri, 2 filtri attivi' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Togli il filtro: Luca' }))
    expect(router.state.location.search).not.toContain('operatore')
    expect(screen.getByRole('button', { name: 'Filtri, 1 filtro attivo' })).toBeInTheDocument()
    expect(requested.at(-1)).toContain('includeCancelled=true')
  })

  it('picks a day of the week from the phone strip', async () => {
    asOwner()
    server.use(
      http.get('/api/admin/calendar', () =>
        HttpResponse.json(
          calendar('2099-03-02', '2099-03-08', [
            appointment({
              start: '2099-03-04T10:00:00+01:00',
              end: '2099-03-04T10:30:00+01:00',
              blockedUntil: '2099-03-04T10:40:00+01:00',
            }),
          ]),
        ),
      ),
    )
    const { router } = renderApp('/admin?data=2099-03-02&vista=settimana')

    const strip = await screen.findByRole('group', { name: 'Giorni della settimana' })
    expect(within(strip).getAllByRole('button')).toHaveLength(7)
    expect(
      within(strip).getByRole('button', { name: 'lun 2 marzo, nessun appuntamento' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(
      within(strip).getByRole('button', { name: 'mer 4 marzo, 1 appuntamento' }),
    )
    expect(router.state.location.search).toContain('data=2099-03-04')
    expect(router.state.location.search).toContain('vista=settimana')
  })
})
