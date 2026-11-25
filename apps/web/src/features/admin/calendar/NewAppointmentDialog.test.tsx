import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { AdminAppointment, AdminStaff, Calendar, CustomerSearchResult } from '@/types/api'
import { adminServices, adminStaff, ownerMe, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

const ANNA = adminStaff[0]!.id
const SERVICE = adminServices[0]!.id

const booked = {
  id: 'appt-1',
  staffId: ANNA,
  serviceId: SERVICE,
  serviceName: 'Taglio',
  start: '2099-03-02T10:00:00+01:00',
  end: '2099-03-02T10:30:00+01:00',
  blockedUntil: '2099-03-02T10:40:00+01:00',
  status: 'Confirmed',
  origin: 'Online',
  customerNote: null,
  cancellationReason: null,
  priceCents: 2500,
  priceIsFrom: false,
  customer: {
    firstName: 'Mario',
    lastName: 'Rossi',
    email: null,
    phone: null,
    hasAccount: true,
    id: 'acct-mario',
  },
  canMove: true,
  canCancel: true,
  canMark: false,
} satisfies AdminAppointment

// Monday 2 March 2099, Barbiere 1 works 09:00–13:00.
const day: Calendar = {
  timeZone: 'Europe/Rome',
  from: '2099-03-02',
  to: '2099-03-02',
  staff: [{ id: ANNA, displayName: 'Barbiere 1', isActive: true, isMe: false }],
  workingHours: [{ staffId: ANNA, dayOfWeek: 1, start: '09:00:00', end: '13:00:00' }],
  timeOff: [],
  appointments: [booked],
}

const found: CustomerSearchResult[] = [
  {
    kind: 'Account',
    id: 'c1',
    firstName: 'Mario',
    lastName: 'Rossi',
    phone: '333 1234567',
    email: 'mario@example.test',
  },
  {
    kind: 'AddressBook',
    id: 'c2',
    firstName: 'Luca',
    lastName: 'Rossini',
    phone: '333 999 0000',
    email: null,
  },
]

function arrange({
  customers = found,
  me = ownerMe,
  staff = adminStaff,
  services = adminServices,
} = {}) {
  const posted: unknown[] = []
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(me)),
    http.get('/api/admin/services', () => HttpResponse.json(services)),
    http.get('/api/admin/staff', () => HttpResponse.json(staff)),
    http.get('/api/admin/calendar', () => HttpResponse.json(day)),
    http.get('/api/admin/customers', ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')!.toLowerCase()
      return HttpResponse.json(
        customers.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)),
      )
    }),
    http.post('/api/admin/appointments', async ({ request }) => {
      posted.push(await request.json())
      return HttpResponse.json(booked, { status: 201 })
    }),
  )
  renderApp('/admin?data=2099-03-02')
  return posted
}

async function openDialog() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Nuovo appuntamento' }, { timeout: 5000 }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'Nuovo appuntamento' })
  // The services and staff arrive asynchronously.
  await within(dialog).findByRole('button', { name: 'Barbiere 1', pressed: true })
  return dialog
}

describe('NewAppointmentDialog', () => {
  it('flags busy and out-of-hours times and books an account customer after confirmation', async () => {
    const posted = arrange()
    const dialog = await openDialog()
    const time = within(dialog).getByLabelText('Ora')

    await userEvent.selectOptions(time, '10:15')
    expect(within(dialog).getByRole('option', { name: '10:15 · occupato' })).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Barbiere 1 è occupato dalle 10:00 alle 10:40',
    )
    expect(within(dialog).getByRole('button', { name: 'Salva appuntamento' })).toBeDisabled()

    await userEvent.selectOptions(time, '14:00')
    expect(
      within(dialog).getByText(/Fuori dall'orario di lavoro di Barbiere 1/),
    ).toBeInTheDocument()

    await userEvent.type(within(dialog).getByRole('searchbox', { name: /Cerca cliente/ }), 'ross')
    const mario = await within(dialog).findByRole('button', { name: /Mario Rossi/ })
    expect(
      within(dialog).getByRole('button', { name: /Luca Rossini.*Rubrica/ }),
    ).toBeInTheDocument()
    await userEvent.click(mario)
    expect(mario).toHaveAttribute('aria-pressed', 'true')

    // Not confirmed yet: nothing is sent.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva appuntamento' }))
    expect(posted).toHaveLength(0)

    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Inserisci comunque' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva appuntamento' }))

    expect((await screen.findAllByText('Appuntamento inserito.'))[0]).toBeInTheDocument()
    expect(posted).toEqual([
      {
        serviceId: SERVICE,
        staffId: ANNA,
        date: '2099-03-02',
        time: '14:00',
        customerAccountId: 'c1',
        tenantCustomerId: null,
        newCustomer: null,
        note: null,
        notifyCustomer: true,
        allowOutsideHours: true,
      },
    ])
  })

  it('validates a new customer prefilled from the search and sends no email without an address', async () => {
    const posted = arrange({ customers: [] })
    const dialog = await openDialog()

    await userEvent.type(
      within(dialog).getByRole('searchbox', { name: /Cerca cliente/ }),
      'giulia bianchi',
    )
    expect(
      await within(dialog).findByText('Nessun cliente trovato con «giulia bianchi».'),
    ).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nuovo cliente' }))

    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Giulia')
    expect(within(dialog).getByLabelText('Cognome')).toHaveValue('Bianchi')
    const phone = within(dialog).getByLabelText('Telefono')
    await userEvent.type(phone, '12')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva appuntamento' }))
    expect(within(dialog).getByText('Numero di telefono non valido.')).toBeInTheDocument()
    expect(posted).toHaveLength(0)

    await userEvent.clear(phone)
    await userEvent.type(phone, '347 222 3344')
    const notify = within(dialog).getByRole('checkbox', { name: /Invia conferma/ })
    expect(notify).toBeDisabled()
    expect(
      within(dialog).getByText("Il cliente non ha un'email: nessun invio."),
    ).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Nota (facoltativa)'), 'Prima volta')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva appuntamento' }))

    expect((await screen.findAllByText('Appuntamento inserito.'))[0]).toBeInTheDocument()
    expect(posted[0]).toMatchObject({
      time: '09:00',
      customerAccountId: null,
      tenantCustomerId: null,
      newCustomer: { firstName: 'Giulia', lastName: 'Bianchi', phone: '347 222 3344', email: null },
      note: 'Prima volta',
      notifyCustomer: false,
      allowOutsideHours: false,
    })
  })

  it('asks for a customer before saving', async () => {
    const posted = arrange()
    const dialog = await openDialog()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva appuntamento' }))

    expect(
      within(dialog).getByText('Scegli un cliente o inseriscine uno nuovo.'),
    ).toBeInTheDocument()
    expect(posted).toHaveLength(0)
  })

  it('lets a staff member book only for themselves', async () => {
    const colleague: AdminStaff = { ...adminStaff[0]!, id: 'other', displayName: 'Barbiere 2' }
    const me: AdminStaff = { ...adminStaff[0]!, isMe: true }
    arrange({
      me: { ...ownerMe, memberships: [{ ...ownerMe.memberships[0]!, role: 'Staff' }] },
      staff: [me, colleague],
      // Both offer the service: only the role keeps the colleague out.
      services: [{ ...adminServices[0]!, staffIds: [ANNA, 'other'] }],
    })
    const dialog = await openDialog()

    expect(within(dialog).queryByRole('button', { name: 'Barbiere 2' })).not.toBeInTheDocument()
  })
})
