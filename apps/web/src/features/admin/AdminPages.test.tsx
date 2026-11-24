import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { MeResponse } from '@/types/api'
import { adminStaff, ownerMe, server, TENANT_ID } from '@/test/server'
import { renderApp } from '@/test/renderApp'

const asOwner = () => server.use(http.get('/api/auth/me', () => HttpResponse.json(ownerMe)))

const staffMe: MeResponse = {
  ...ownerMe,
  id: '01a1eeca-0000-7000-8000-0000000057af',
  email: 'staff@bookly.local',
  memberships: [{ ...ownerMe.memberships[0]!, role: 'Staff' }],
}

/** Toasts may be briefly rendered twice while react-hot-toast measures them. */
const expectToast = async (text: string | RegExp) =>
  expect((await screen.findAllByText(text))[0]).toBeInTheDocument()

const forbidden = () => HttpResponse.json({ title: 'Forbidden', status: 403 }, { status: 403 })

describe('ServicesPage', () => {
  it('lists services with who offers them and creates a new one', async () => {
    asOwner()
    let body: unknown = null
    server.use(
      http.post('/api/admin/services', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'new', ...(body as object), staffIds: [] }, { status: 201 })
      }),
    )
    renderApp('/admin/servizi')

    expect(await screen.findByText('Lo offrono: Barbiere 1')).toBeInTheDocument()
    expect(screen.getByText(/30 min \+ 10 min di pausa · 25 €/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Nuovo servizio' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuovo servizio' })
    expect(within(dialog).getByLabelText('Nome')).toHaveFocus()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva' }))
    expect(await within(dialog).findByText('Campo obbligatorio.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Barba')
    await userEvent.type(within(dialog).getByLabelText('Prezzo (€)'), '12,50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva' }))

    await expectToast('Modifiche salvate.')
    expect(body).toMatchObject({ name: 'Barba', priceCents: 1250, durationMinutes: 30 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explains why a service with appointments cannot be deleted', async () => {
    asOwner()
    server.use(
      http.delete('/api/admin/services/:id', () =>
        HttpResponse.json({ title: 'In use', status: 409, code: 'admin.in_use' }, { status: 409 }),
      ),
    )
    renderApp('/admin/servizi')

    await userEvent.click(await screen.findByRole('button', { name: 'Elimina Taglio' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Eliminare il servizio?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }))

    expect(await screen.findByText(/invece di eliminarlo, disattivalo/)).toBeInTheDocument()
  })
})

describe('StaffPage', () => {
  it('saves the services a staff member offers', async () => {
    asOwner()
    let body: { serviceIds?: string[] } = {}
    server.use(
      http.put('/api/admin/staff/:id', async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json({ ...adminStaff[0], ...body })
      }),
    )
    renderApp('/admin/staff')

    await userEvent.click(await screen.findByRole('button', { name: 'Modifica Barbiere 1' }))
    const dialog = await screen.findByRole('dialog', { name: 'Modifica operatore' })
    const service = within(dialog).getByRole('checkbox', { name: 'Taglio' })
    expect(service).toBeChecked()
    await userEvent.click(service)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva' }))

    await expectToast('Modifiche salvate.')
    expect(body.serviceIds).toEqual([])
  })
})

describe('SchedulePage', () => {
  it('edits weekly hours, blocking overlapping intervals', async () => {
    asOwner()
    let saved: unknown = null
    server.use(
      http.put('/api/admin/staff/:id/working-hours', async ({ request }) => {
        saved = await request.json()
        return HttpResponse.json((saved as { intervals: unknown[] }).intervals)
      }),
    )
    renderApp('/admin/orari')

    const mondayStarts = await screen.findAllByLabelText('Lunedì Dalle')
    expect(mondayStarts.map((i) => (i as HTMLInputElement).value)).toEqual(['09:00', '15:00'])
    expect(screen.getAllByText('Chiuso')).toHaveLength(6)

    // 15:00 → 12:00 overlaps the morning interval.
    const afternoon = mondayStarts[1]!
    await userEvent.clear(afternoon)
    await userEvent.type(afternoon, '12:00')
    expect(await screen.findByText(/Fasce non valide/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salva orari' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Rimuovi fascia Lunedì 12:00–19:00' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi fascia Martedì' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salva orari' }))

    expect(await screen.findByText('Orari salvati.')).toBeInTheDocument()
    expect(saved).toEqual({
      intervals: [
        { dayOfWeek: 1, start: '09:00', end: '13:00' },
        { dayOfWeek: 2, start: '09:00', end: '13:00' },
      ],
    })
  })

  it('adds whole-day time off and warns about conflicting appointments', async () => {
    asOwner()
    let body: unknown = null
    server.use(
      http.post('/api/admin/staff/:id/time-off', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            timeOff: {
              id: 'off-1',
              start: '2027-03-02T00:00:00+01:00',
              end: '2027-03-03T00:00:00+01:00',
              reason: 'Ferie',
            },
            conflictingAppointments: 2,
          },
          { status: 201 },
        )
      }),
    )
    renderApp('/admin/orari')

    await userEvent.click(await screen.findByRole('button', { name: 'Aggiungi assenza' }))
    const dialog = await screen.findByRole('dialog', { name: 'Aggiungi assenza' })
    const start = within(dialog).getByLabelText('Dal giorno')
    const end = within(dialog).getByLabelText('Al giorno')
    await userEvent.clear(start)
    await userEvent.type(start, '2027-03-02')
    await userEvent.clear(end)
    await userEvent.type(end, '2027-03-02')
    await userEvent.type(within(dialog).getByLabelText('Motivo (facoltativo)'), 'Ferie')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aggiungi' }))

    expect(await screen.findByText(/ci sono 2 appuntamenti confermati/)).toBeInTheDocument()
    expect(body).toEqual({
      startDate: '2027-03-02',
      endDate: '2027-03-02',
      startTime: null,
      endTime: null,
      reason: 'Ferie',
    })
  })

  it('lets a staff member manage only their own schedule', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(staffMe)),
      http.get('/api/admin/staff', () =>
        HttpResponse.json([
          ...adminStaff,
          {
            ...adminStaff[0]!,
            id: '44444444-4444-4444-8444-444444444444',
            displayName: 'Io',
            isMe: true,
          },
        ]),
      ),
    )
    renderApp('/admin/orari')

    expect(await screen.findAllByLabelText('Lunedì Dalle')).toHaveLength(2)
    // A single editable operator: no selector, and it is the signed-in one.
    expect(screen.queryByLabelText('Operatore')).not.toBeInTheDocument()
  })
})

describe('SettingsPage', () => {
  it('saves business data and booking rules', async () => {
    asOwner()
    let body: Record<string, unknown> = {}
    let calls = 0
    server.use(
      http.put('/api/admin/settings', async ({ request }) => {
        calls++
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ slug: 'barberia-demo', ...body })
      }),
    )
    renderApp('/admin/impostazioni')

    // The save bar appears only with unsaved changes (DEC-041).
    const name = await screen.findByLabelText("Nome dell'attività")
    expect(screen.queryByRole('button', { name: 'Salva modifiche' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Pagina pubblica (si apre in una nuova scheda)' }),
    ).toHaveAttribute('href', '/b/barberia-demo')

    await userEvent.clear(name)
    await userEvent.type(name, 'Sfumo Barber')
    await userEvent.selectOptions(
      screen.getByLabelText('Intervallo tra gli orari proposti'),
      '30 minuti',
    )
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))

    await expectToast('Modifiche salvate.')
    expect(calls).toBe(1)
    expect(body).toMatchObject({
      name: 'Sfumo Barber',
      slotIntervalMinutes: 30,
      timeZone: 'Europe/Rome',
    })
  })

  it('discards unsaved changes from the save bar (DEC-041)', async () => {
    asOwner()
    renderApp('/admin/impostazioni')

    const name = await screen.findByLabelText("Nome dell'attività")
    const saved = (name as HTMLInputElement).value
    await userEvent.type(name, ' e figli')
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(name).toHaveValue(saved)
    expect(screen.queryByText('Modifiche non salvate')).not.toBeInTheDocument()
  })

  it('groups the email notices and saves each switch on its own (DEC-040)', async () => {
    asOwner()
    let body: Record<string, unknown> = {}
    server.use(
      http.put('/api/admin/settings', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ slug: 'barberia-demo', ...body })
      }),
    )
    renderApp('/admin/impostazioni')

    const notices = await screen.findByRole('group', { name: 'Avvisami via email' })
    expect(notices).toHaveAccessibleDescription(/ai titolari e all'operatore dell'appuntamento/)
    const booking = within(notices).getByRole('checkbox', {
      name: /^Quando un cliente prenota online/,
    })
    const cancellation = within(notices).getByRole('checkbox', {
      name: /^Quando un cliente disdice online/,
    })
    expect(booking).toBeChecked()
    expect(booking).toHaveAccessibleDescription(/inserisci tu dal calendario non mandano avvisi/)
    expect(cancellation).toBeChecked()

    await userEvent.click(booking)
    const save = screen.getByRole('button', { name: 'Salva modifiche' })
    expect(save).toBeEnabled()
    await userEvent.click(save)

    await expectToast('Modifiche salvate.')
    expect(body).toMatchObject({ notifyOnOnlineBooking: false, notifyOnCustomerCancellation: true })
    expect(booking).not.toBeChecked()
    expect(cancellation).toBeChecked()
    // Saved: the bar goes away.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Salva modifiche' })).not.toBeInTheDocument(),
    )
  })

  it('is reserved to the owner', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(staffMe)),
      http.get('/api/admin/settings', forbidden),
    )
    renderApp('/admin/impostazioni')

    expect(await screen.findByText(/riservata al titolare/)).toBeInTheDocument()
  })
})

describe('BrandPage', () => {
  it('previews the draft brand, checks contrast and saves it', async () => {
    asOwner()
    let body: unknown = null
    server.use(
      http.put('/api/admin/brand', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...(body as object), hasLogo: false })
      }),
    )
    renderApp('/admin/brand')

    const preview = await screen.findByRole('figure', { name: 'Anteprima' })
    expect(preview.style.getPropertyValue('--bk-color-primary')).toBe('#e8b05a')
    expect(screen.getByText(/Contrasto del testo .*leggibile/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salva modifiche' })).not.toBeInTheDocument()

    // Ochre on a light ground is too pale for text.
    await userEvent.click(screen.getByRole('radio', { name: 'Chiaro' }))
    expect(screen.getByText(/troppo basso per i testi/)).toBeInTheDocument()
    expect(preview.style.getPropertyValue('--bk-color-bg')).toBe('#faf9f7')

    await userEvent.click(screen.getByRole('button', { name: 'Bosco' }))
    expect(screen.getByText(/Contrasto del testo .*leggibile/)).toBeInTheDocument()
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    await expectToast('Modifiche salvate.')
    expect(body).toEqual({ primaryColor: '#2f6b4f', ground: 'Light', headingFont: 'Script' })
  })

  it('rejects logos that are not PNG/WebP before uploading', async () => {
    asOwner()
    renderApp('/admin/brand')

    const input = await screen.findByLabelText('Carica logo')
    const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })
    await userEvent.upload(input, svg, { applyAccept: false })

    expect(await screen.findByText(/PNG o WebP di massimo 200 KB/)).toBeInTheDocument()
  })
})

// Keeps TENANT_ID referenced: the admin header is sent for the active tenant.
it('sends the active tenant header on admin requests', async () => {
  asOwner()
  let header: string | null = null
  server.use(
    http.get('/api/admin/services', ({ request }) => {
      header = request.headers.get('X-Bookly-Tenant')
      return HttpResponse.json([])
    }),
  )
  renderApp('/admin/servizi')

  expect(await screen.findByText(/Nessun servizio/)).toBeInTheDocument()
  expect(header).toBe(TENANT_ID)
})
