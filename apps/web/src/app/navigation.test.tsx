import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { customerMe, ownerMe, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'
import type { MeResponse } from '@/types/api'

const staffMe: MeResponse = {
  ...ownerMe,
  memberships: [{ ...ownerMe.memberships[0]!, role: 'Staff' }],
}
/** Any value: the login endpoint is mocked. */
const anyPassword = ['test', 'only', 'value'].join('-')
const signedInAs = (me: MeResponse) =>
  server.use(http.get('/api/auth/me', () => HttpResponse.json(me)))

describe('navigation between areas', () => {
  it('offers login and sign-up on the landing page', async () => {
    renderApp('/')

    const menu = await screen.findByRole('navigation', { name: 'Menu del sito' })
    expect(within(menu).getByRole('link', { name: 'Accedi' })).toHaveAttribute('href', '/login')
    expect(within(menu).getByRole('link', { name: 'Registrati' })).toHaveAttribute(
      'href',
      '/registrati',
    )
  })

  it('shows a signed-in owner the way to their areas from the landing page', async () => {
    signedInAs(ownerMe)
    renderApp('/')

    const menu = await screen.findByRole('navigation', { name: 'Menu del sito' })
    expect(within(menu).getByRole('link', { name: 'Gestione attività' })).toHaveAttribute(
      'href',
      '/admin',
    )
    expect(within(menu).getByRole('link', { name: 'Le mie prenotazioni' })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: 'La tua area' })).toHaveAttribute(
      'href',
      '/admin',
    )
    expect(within(menu).getByRole('button', { name: 'Esci' })).toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: 'Accedi' })).not.toBeInTheDocument()
  })

  it('logs in without a requested page and lands in the user area', async () => {
    let loggedIn = false
    server.use(
      http.post('/api/auth/login', () => {
        loggedIn = true
        return new HttpResponse(null, { status: 204 })
      }),
      http.get('/api/auth/me', () =>
        loggedIn ? HttpResponse.json(ownerMe) : new HttpResponse(null, { status: 204 }),
      ),
    )
    const { router } = renderApp('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'titolare@bookly.local')
    await userEvent.type(screen.getByLabelText('Password'), anyPassword)
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    expect(await screen.findByRole('heading', { name: 'Calendario' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
  })

  it("links the admin sidebar to the tenant's public page and to the own bookings", async () => {
    signedInAs(ownerMe)
    renderApp('/admin/servizi')

    expect(await screen.findByRole('link', { name: 'Vedi pagina pubblica' })).toHaveAttribute(
      'href',
      '/b/barberia-demo',
    )
    expect(screen.getByRole('link', { name: 'Le mie prenotazioni' })).toHaveAttribute(
      'href',
      '/account/appuntamenti',
    )
  })

  it('links the customer area to the business admin only for members', async () => {
    server.use(http.get('/api/me/appointments', () => HttpResponse.json([])))
    signedInAs(ownerMe)
    const { unmount } = renderApp('/account/appuntamenti')
    expect(await screen.findByRole('link', { name: 'Gestione attività' })).toHaveAttribute(
      'href',
      '/admin',
    )
    unmount()

    signedInAs(customerMe)
    renderApp('/account/appuntamenti')
    expect(await screen.findByRole('heading', { name: 'I tuoi appuntamenti' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Gestione attività' })).not.toBeInTheDocument()
  })

  it('keeps staff out of the owner pages with a way back to the calendar', async () => {
    signedInAs(staffMe)
    renderApp('/admin/servizi')

    expect(
      await screen.findByRole('heading', { name: /riservata al titolare/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vai alla tua area' })).toHaveAttribute(
      'href',
      '/admin',
    )
    expect(screen.queryByRole('button', { name: /nuovo servizio/i })).not.toBeInTheDocument()
  })

  it('sends a customer who opens the admin area back to their bookings', async () => {
    signedInAs(customerMe)
    renderApp('/admin')

    expect(await screen.findByRole('link', { name: 'Vai alla tua area' })).toHaveAttribute(
      'href',
      '/account/appuntamenti',
    )
  })
})
