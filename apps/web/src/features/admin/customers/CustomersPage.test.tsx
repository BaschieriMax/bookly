import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type {
  CustomerAppointment,
  CustomerDetail,
  CustomerListItem,
  UpdateCustomerRequest,
} from '@/types/api'
import { ownerMe, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

const GIULIA = 'b1a1eeca-0000-7000-8000-000000000001'
const MARIO = 'b1a1eeca-0000-7000-8000-000000000002'

const customers: CustomerListItem[] = [
  {
    kind: 'AddressBook',
    id: GIULIA,
    firstName: 'Giulia',
    lastName: 'Rossetti',
    phone: '347 222 3344',
    email: 'giulia@example.test',
    appointments: 24,
    lastVisit: '2099-02-15T10:00:00+01:00',
    nextAppointment: '2099-03-02T10:00:00+01:00',
  },
  {
    kind: 'Account',
    id: MARIO,
    firstName: 'Mario',
    lastName: 'Rossi',
    phone: null,
    email: 'mario@example.test',
    appointments: 1,
    lastVisit: '2099-02-15T12:00:00+01:00',
    nextAppointment: null,
  },
]

const giulia: CustomerDetail = {
  kind: 'AddressBook',
  id: GIULIA,
  firstName: 'Giulia',
  lastName: 'Rossetti',
  phone: '347 222 3344',
  email: 'giulia@example.test',
  createdAt: '2098-01-31T10:00:00+01:00',
  stats: {
    total: 24,
    upcoming: 1,
    past: 23,
    completed: 21,
    noShow: 1,
    cancelled: 1,
    lastVisit: '2099-02-15T10:00:00+01:00',
    nextAppointment: '2099-03-02T10:00:00+01:00',
  },
}

const mario: CustomerDetail = {
  kind: 'Account',
  id: MARIO,
  firstName: 'Mario',
  lastName: 'Rossi',
  phone: null,
  email: 'mario@example.test',
  createdAt: null,
  stats: {
    total: 1,
    upcoming: 0,
    past: 1,
    completed: 1,
    noShow: 0,
    cancelled: 0,
    lastVisit: '2099-02-15T12:00:00+01:00',
    nextAppointment: null,
  },
}

// 23 past visits, one a week back from 15 February 2099.
const past: CustomerAppointment[] = Array.from({ length: 23 }, (_, week) => {
  const day = new Date(Date.UTC(2099, 1, 15 - 7 * week))
  return {
    id: `past-${week}`,
    start: `${day.toISOString().slice(0, 10)}T10:00:00+01:00`,
    serviceName: week % 2 === 0 ? 'Taglio' : 'Taglio + Barba',
    staffName: 'Barbiere 1',
    status: 'Completed',
    origin: 'Business',
  }
})

const upcoming: CustomerAppointment[] = [
  {
    id: 'next',
    start: '2099-03-02T10:00:00+01:00',
    serviceName: 'Taglio',
    staffName: 'Barbiere 1',
    status: 'Confirmed',
    origin: 'Business',
  },
]

function arrange({ me = ownerMe } = {}) {
  const calls = {
    list: [] as URLSearchParams[],
    put: [] as UpdateCustomerRequest[],
    deleted: [] as string[],
  }
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(me)),
    http.get('/api/admin/customers/list', ({ request }) => {
      const params = new URL(request.url).searchParams
      calls.list.push(params)
      const q = (params.get('q') ?? '').toLowerCase()
      const kind = params.get('kind')
      const items = customers.filter(
        (c) =>
          (!kind || c.kind === kind) && `${c.firstName} ${c.lastName}`.toLowerCase().includes(q),
      )
      return HttpResponse.json({ total: items.length, page: 1, pageSize: 50, items })
    }),
    http.get('/api/admin/customers/address-book/:id', () => HttpResponse.json(giulia)),
    http.get('/api/admin/customers/account/:id', () => HttpResponse.json(mario)),
    http.get('/api/admin/customers/:kind/:id/appointments', ({ request, params }) => {
      const search = new URL(request.url).searchParams
      const page = Number(search.get('page'))
      const all =
        params.kind === 'account'
          ? past.slice(0, 1)
          : search.get('when') === 'upcoming'
            ? upcoming
            : past
      return HttpResponse.json({
        total: all.length,
        page,
        pageSize: 10,
        items: all.slice((page - 1) * 10, page * 10),
      })
    }),
    http.put('/api/admin/customers/address-book/:id', async ({ request }) => {
      const body = (await request.json()) as UpdateCustomerRequest
      calls.put.push(body)
      return HttpResponse.json({ ...giulia, ...body })
    }),
    http.delete('/api/admin/customers/address-book/:id', ({ params }) => {
      calls.deleted.push(String(params.id))
      return HttpResponse.json({ cancelledAppointments: 1 })
    }),
  )
  renderApp('/admin/clienti')
  return calls
}

async function openGiulia() {
  const table = await screen.findByRole('table', {}, { timeout: 5000 })
  await userEvent.click(within(table).getByRole('button', { name: 'Giulia Rossetti' }))
  return screen.findByRole('dialog', { name: /Giulia Rossetti/ })
}

describe('CustomersPage', () => {
  it('lists address-book entries and accounts, filters them by kind and searches by name', async () => {
    const calls = arrange()
    const table = await screen.findByRole('table', {}, { timeout: 5000 })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent('Giulia Rossetti')
    expect(rows[1]).toHaveTextContent('Rubrica')
    expect(rows[1]).toHaveTextContent('24')
    expect(rows[2]).toHaveTextContent('Account')
    expect(screen.getByRole('status')).toHaveTextContent('2 clienti')

    await userEvent.click(screen.getByRole('button', { name: 'Con account' }))
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2))
    expect(calls.list.at(-1)?.get('kind')).toBe('Account')
    expect(screen.getByRole('button', { name: 'Con account' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Tutti' }))
    await userEvent.type(screen.getByLabelText('Cerca per nome, telefono o email'), 'giu')
    await waitFor(() => expect(calls.list.at(-1)?.get('q')).toBe('giu'))
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2))
  })

  it('opens a customer on the Dati tab and corrects an address-book entry', async () => {
    const calls = arrange()
    const dialog = await openGiulia()

    expect(within(dialog).getByRole('tab', { name: 'Dati' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(within(dialog).getByText(/Nella rubrica dal 31 gennaio 2098/)).toBeInTheDocument()
    const phone = await within(dialog).findByLabelText('Telefono')
    await userEvent.clear(phone)
    await userEvent.type(phone, '12')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva modifiche' }))
    expect(await within(dialog).findByText('Numero di telefono non valido.')).toBeInTheDocument()

    await userEvent.clear(phone)
    await userEvent.type(phone, '348 111 2233')
    await userEvent.clear(within(dialog).getByLabelText('Email (facoltativa)'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salva modifiche' }))

    await waitFor(() =>
      expect(calls.put).toEqual([
        { firstName: 'Giulia', lastName: 'Rossetti', phone: '348 111 2233', email: null },
      ]),
    )
    expect(await screen.findByText('Dati del cliente aggiornati.')).toBeInTheDocument()
  })

  it('shows the numbers and pages the appointments ten at a time', async () => {
    arrange()
    const dialog = await openGiulia()

    await userEvent.click(within(dialog).getByRole('tab', { name: 'Appuntamenti (24)' }))
    expect(within(dialog).getByRole('tab', { name: 'Appuntamenti (24)' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // The form stays mounted (hidden) and "Salva modifiche" is only offered on Dati.
    expect(within(dialog).queryByRole('button', { name: 'Salva modifiche' })).toBeNull()
    expect(within(dialog).getByText('Completati').nextSibling).toHaveTextContent('21')
    expect(within(dialog).getByText('Non presentati').nextSibling).toHaveTextContent('1')

    // Upcoming first, since there is one.
    const upcomingButton = within(dialog).getByRole('button', { name: 'Prossimi 1' })
    expect(upcomingButton).toHaveAttribute('aria-pressed', 'true')
    expect(await within(dialog).findByText('Mostrati 1 di 1')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Passati 23' }))
    expect(await within(dialog).findByText('Mostrati 10 di 23')).toBeInTheDocument()
    const table = within(dialog).getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(11)
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Completato')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mostra altri 10' }))
    expect(await within(dialog).findByText('Mostrati 20 di 23')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mostra altri 10' }))
    expect(await within(dialog).findByText('Mostrati 23 di 23')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Mostra altri 10' })).toBeNull()

    // Arrow keys move between the tabs.
    within(dialog).getByRole('tab', { name: 'Appuntamenti (24)' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(within(dialog).getByRole('tab', { name: 'Dati' })).toHaveFocus()
    expect(within(dialog).getByRole('tab', { name: 'Dati' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('erases an address-book entry after a confirmation that mentions the upcoming appointment', async () => {
    const calls = arrange()
    const dialog = await openGiulia()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancella dati' }))
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Cancellare i dati di Giulia Rossetti?',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(confirm).toHaveTextContent('il prossimo è lun 2 mar 2099, 10:00')

    await userEvent.click(within(confirm).getByRole('button', { name: 'Mantieni' }))
    expect(await screen.findByRole('dialog', { name: /Giulia Rossetti/ })).toBeInTheDocument()
    expect(calls.deleted).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'Cancella dati' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancella dati' }),
    )
    expect(
      await screen.findByText('Dati del cliente cancellati e annullato 1 appuntamento futuro.'),
    ).toBeInTheDocument()
    expect(calls.deleted).toEqual([GIULIA])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows accounts read-only, without download or erase', async () => {
    arrange()
    const table = await screen.findByRole('table', {}, { timeout: 5000 })
    await userEvent.click(within(table).getByRole('button', { name: 'Mario Rossi' }))
    const dialog = await screen.findByRole('dialog', { name: /Mario Rossi/ })

    expect(await within(dialog).findByText(/Ha un account Bookly/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Scarica dati' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Cancella dati' })).toBeNull()

    await userEvent.click(within(dialog).getByRole('tab', { name: 'Appuntamenti (1)' }))
    // No upcoming appointment: the past ones are shown.
    expect(within(dialog).getByRole('button', { name: 'Passati 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(await within(dialog).findByText('Mostrati 1 di 1')).toBeInTheDocument()
  })

  it('is reserved to owners', async () => {
    arrange({ me: { ...ownerMe, memberships: [{ ...ownerMe.memberships[0]!, role: 'Staff' }] } })
    expect(
      await screen.findByText(
        "Questa sezione è riservata al titolare dell'attività.",
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
  })
})
