import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { MeResponse, NavigationAdminItem, PlatformTenant } from '@/types/api'
import { ownerMe, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

const superAdmin: MeResponse = {
  ...ownerMe,
  id: '01a1eeca-0000-7000-8000-00000000ad01',
  email: 'admin@bookly.local',
  platformRoles: ['SuperAdmin'],
  memberships: [],
}

const tenant = (overrides: Partial<PlatformTenant> = {}): PlatformTenant => ({
  id: 't-1',
  slug: 'barberia-demo',
  name: 'Barberia Demo',
  status: 'Active',
  timeZone: 'Europe/Rome',
  createdAt: '2026-11-01T10:00:00Z',
  owners: [
    {
      userId: 'u-1',
      email: 'titolare@bookly.local',
      firstName: 'Titolare',
      lastName: 'Demo',
      pending: false,
    },
    {
      userId: 'u-2',
      email: 'nuovo@bookly.local',
      firstName: 'Nuovo',
      lastName: 'Socio',
      pending: true,
    },
  ],
  staffCount: 2,
  serviceCount: 4,
  ...overrides,
})

const asSuperAdmin = () => server.use(http.get('/api/auth/me', () => HttpResponse.json(superAdmin)))

describe('TenantsPage', () => {
  it('creates a tenant with a slug suggested from the name', async () => {
    asSuperAdmin()
    let body: Record<string, string> = {}
    server.use(
      http.get('/api/platform/tenants', () => HttpResponse.json([tenant()])),
      http.post('/api/platform/tenants', async ({ request }) => {
        body = (await request.json()) as Record<string, string>
        return HttpResponse.json(tenant({ id: 't-2', slug: body.slug!, name: body.name! }), {
          status: 201,
        })
      }),
    )
    renderApp('/platform/tenant')

    expect(
      await screen.findByRole('heading', { name: 'Barberia Demo' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('2 operatori · 4 servizi', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Invito in attesa')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Nuova attività' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuova attività' })
    await userEvent.type(within(dialog).getByLabelText("Nome dell'attività"), 'Sfumo Barber & Co.')
    expect(within(dialog).getByLabelText('Indirizzo della pagina')).toHaveValue('sfumo-barber-co')
    await userEvent.type(within(dialog).getByLabelText('Email del titolare'), 'gianni@example.test')
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Gianni')
    await userEvent.type(within(dialog).getByLabelText('Cognome'), 'Sfumo')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nuova attività' }))

    expect((await screen.findAllByText(/abbiamo inviato l'invito/))[0]).toBeInTheDocument()
    expect(body).toEqual({
      name: 'Sfumo Barber & Co.',
      slug: 'sfumo-barber-co',
      timeZone: 'Europe/Rome',
      ownerEmail: 'gianni@example.test',
      ownerFirstName: 'Gianni',
      ownerLastName: 'Sfumo',
    })
  })

  it('shows a taken slug and suspends after confirmation', async () => {
    asSuperAdmin()
    let status: unknown = null
    server.use(
      http.get('/api/platform/tenants', () => HttpResponse.json([tenant()])),
      http.post('/api/platform/tenants', () =>
        HttpResponse.json(
          { title: 'Taken', status: 409, code: 'platform.slug_taken' },
          { status: 409 },
        ),
      ),
      http.put('/api/platform/tenants/:id/status', async ({ request }) => {
        status = await request.json()
        return HttpResponse.json(tenant({ status: 'Suspended' }))
      }),
    )
    renderApp('/platform/tenant')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Nuova attività' }, { timeout: 5000 }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Nuova attività' })
    await userEvent.type(within(dialog).getByLabelText("Nome dell'attività"), 'Barberia Demo')
    await userEvent.type(within(dialog).getByLabelText('Email del titolare'), 'x@example.test')
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'X')
    await userEvent.type(within(dialog).getByLabelText('Cognome'), 'Y')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nuova attività' }))
    expect((await screen.findAllByText(/già usato da un'altra attività/))[0]).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }))

    await userEvent.click(screen.getByRole('button', { name: 'Sospendi' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Sospendere «Barberia Demo»?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Sospendi' }))

    expect((await screen.findAllByText('Attività sospesa.'))[0]).toBeInTheDocument()
    expect(status).toEqual({ status: 'Suspended' })
  })

  it('drops the admin area at once when a super-admin suspends their own tenant', async () => {
    let suspended = false
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          ...ownerMe,
          platformRoles: ['SuperAdmin'],
          memberships: suspended ? [] : ownerMe.memberships,
        }),
      ),
      http.get('/api/platform/tenants', () =>
        HttpResponse.json([tenant({ status: suspended ? 'Suspended' : 'Active' })]),
      ),
      http.put('/api/platform/tenants/:id/status', () => {
        suspended = true
        return HttpResponse.json(tenant({ status: 'Suspended' }))
      }),
    )
    renderApp('/platform/tenant')

    expect(
      (await screen.findAllByRole('link', { name: 'Gestione attività' }, { timeout: 5000 }))[0],
    ).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Sospendi' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Sospendere «Barberia Demo»?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Sospendi' }))

    await waitFor(() =>
      expect(screen.queryAllByRole('link', { name: 'Gestione attività' })).toHaveLength(0),
    )
  })

  it('re-sends a pending invitation', async () => {
    asSuperAdmin()
    let body: unknown = null
    server.use(
      http.get('/api/platform/tenants', () => HttpResponse.json([tenant()])),
      http.post('/api/platform/tenants/:id/owners', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(tenant())
      }),
    )
    renderApp('/platform/tenant')

    await userEvent.click(
      await screen.findByRole(
        'button',
        { name: 'Reinvia invito a Nuovo Socio' },
        { timeout: 5000 },
      ),
    )

    expect((await screen.findAllByText('Invito inviato di nuovo.'))[0]).toBeInTheDocument()
    expect(body).toEqual({ email: 'nuovo@bookly.local', firstName: 'Nuovo', lastName: 'Socio' })
  })
})

describe('NavigationAdminPage', () => {
  it('hides an item and swaps the order of two items', async () => {
    asSuperAdmin()
    const items: NavigationAdminItem[] = [
      {
        id: 1,
        key: 'admin.calendar',
        labelKey: 'nav.calendar',
        icon: 'calendar-days',
        route: '/admin',
        area: 'Admin',
        sortOrder: 10,
        isEnabled: true,
        roles: ['Owner', 'Staff'],
      },
      {
        id: 2,
        key: 'admin.services',
        labelKey: 'nav.services',
        icon: 'scissors',
        route: '/admin/servizi',
        area: 'Admin',
        sortOrder: 20,
        isEnabled: true,
        roles: ['Owner'],
      },
    ]
    const patches: unknown[] = []
    server.use(
      http.get('/api/platform/navigation', () => HttpResponse.json(items)),
      http.patch('/api/platform/navigation/:id', async ({ request, params }) => {
        patches.push({ id: Number(params.id), ...((await request.json()) as object) })
        return HttpResponse.json(items[0])
      }),
    )
    renderApp('/platform/navigazione')

    const services = await screen.findByText('Servizi', { selector: 'span' }, { timeout: 5000 })
    const row = services.closest('li')!
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Visibile' }))
    expect((await screen.findAllByText('Menu aggiornato.'))[0]).toBeInTheDocument()
    const down = screen.getByRole('button', { name: 'Sposta giù Calendario' })
    await waitFor(() => expect(down).toBeEnabled())
    await userEvent.click(down)
    await waitFor(() => expect(patches).toHaveLength(3))
    expect(patches).toEqual([
      { id: 2, isEnabled: false, sortOrder: null },
      { id: 1, isEnabled: null, sortOrder: 20 },
      { id: 2, isEnabled: null, sortOrder: 10 },
    ])
  })
})

describe('AcceptInvitationPage', () => {
  it('activates the account and opens the admin area', async () => {
    let body: unknown = null
    let signedIn = false
    server.use(
      http.get('/api/auth/me', () =>
        signedIn ? HttpResponse.json(ownerMe) : new HttpResponse(null, { status: 204 }),
      ),
      http.get('/api/auth/invitation', () =>
        HttpResponse.json({
          email: 'gianni@example.test',
          firstName: 'Gianni',
          lastName: 'Sfumo',
          tenants: ['Sfumo Barber'],
        }),
      ),
      http.post('/api/auth/accept-invitation', async ({ request }) => {
        body = await request.json()
        signedIn = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { router } = renderApp('/invito?userId=u-9&token=abc')

    expect(
      await screen.findByText(/sei il titolare di Sfumo Barber/, {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Password'), 'una-password-lunga')
    await userEvent.click(screen.getByRole('button', { name: 'Attiva account' }))
    expect(await screen.findByText(/accettare l'informativa/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: "Ho letto l'informativa privacy" }))
    await userEvent.click(screen.getByRole('button', { name: 'Attiva account' }))

    await screen.findByRole('navigation', { name: "Menu dell'attività" }, { timeout: 5000 })
    expect(router.state.location.pathname).toBe('/admin')
    expect(body).toEqual({
      userId: 'u-9',
      token: 'abc',
      password: 'una-password-lunga',
      acceptPrivacy: true,
    })
  })

  it('explains an expired or used link', async () => {
    server.use(
      http.get('/api/auth/invitation', () =>
        HttpResponse.json(
          { title: 'Invalid', status: 400, code: 'auth.invalid_token' },
          { status: 400 },
        ),
      ),
    )
    renderApp('/invito?userId=u-9&token=old')

    expect(
      await screen.findByText(/scaduto o è già stato usato/, {}, { timeout: 5000 }),
    ).toBeInTheDocument()
  })
})
