import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { addDays, todayIn } from '@/lib/format'
import { customerMe, demoAppointment, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

const SERVICE = '11111111-1111-4111-8111-111111111111'
const day = addDays(todayIn('Europe/Rome'), 2)
const scheduleUrl = `/b/barberia-demo/prenota?servizio=${SERVICE}&data=${day}`

describe('BookingPage', () => {
  it('asks for the service first', async () => {
    renderApp('/b/barberia-demo/prenota')

    expect(
      await screen.findByRole('heading', { name: 'Scegli il servizio' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Passo 1 di 3 · Servizio')).toBeInTheDocument()
  })

  it('books a time end to end and shows the confirmation', async () => {
    let posted: unknown = null
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(customerMe)),
      http.post('/api/tenants/barberia-demo/appointments', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json(demoAppointment({ start: `${day}T09:15:00+01:00` }), {
          status: 201,
        })
      }),
    )
    renderApp(scheduleUrl)

    await userEvent.click(await screen.findByRole('button', { name: '09:15' }))
    await userEvent.click(screen.getByRole('button', { name: 'Continua' }))
    await userEvent.type(await screen.findByLabelText(/note per l'operatore/i), 'sfumatura bassa')
    await userEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }))

    expect(
      await screen.findByRole('heading', { name: 'Prenotazione confermata' }),
    ).toBeInTheDocument()
    expect(posted).toEqual({
      serviceId: SERVICE,
      staffId: null,
      start: `${day}T09:15:00+01:00`,
      note: 'sfumatura bassa',
    })
  })

  it('goes back to the times when the slot was just taken (409)', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(customerMe)),
      http.post('/api/tenants/barberia-demo/appointments', () =>
        HttpResponse.json(
          { title: 'Taken', status: 409, code: 'booking.slot_unavailable' },
          { status: 409 },
        ),
      ),
    )
    const { router } = renderApp(
      `${scheduleUrl}&ora=${encodeURIComponent(`${day}T09:00:00+01:00`)}`,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Conferma prenotazione' }))

    expect(await screen.findByRole('button', { name: 'Scegli un orario' })).toBeDisabled()
    expect(router.state.location.search).not.toContain('ora=')
  })

  it('asks anonymous users to log in, keeping the whole selection in the redirect', async () => {
    const start = encodeURIComponent(`${day}T09:00:00+01:00`)
    renderApp(`${scheduleUrl}&ora=${start}`)

    const login = await screen.findByRole('link', { name: 'Accedi' })
    const redirect = new URL(login.getAttribute('href')!, 'http://localhost').searchParams.get(
      'redirect',
    )!
    const target = new URL(redirect, 'http://localhost')
    expect(target.pathname).toBe('/b/barberia-demo/prenota')
    expect(Object.fromEntries(target.searchParams)).toEqual({
      servizio: SERVICE,
      data: day,
      ora: `${day}T09:00:00+01:00`,
    })
    expect(screen.queryByRole('button', { name: 'Conferma prenotazione' })).not.toBeInTheDocument()
  })

  it('blocks booking until the email is confirmed', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ ...customerMe, emailConfirmed: false })),
    )
    renderApp(`${scheduleUrl}&ora=${encodeURIComponent(`${day}T09:00:00+01:00`)}`)

    expect(await screen.findByRole('alert')).toHaveTextContent(/conferma prima la tua email/i)
    expect(screen.queryByRole('button', { name: 'Conferma prenotazione' })).not.toBeInTheDocument()
  })
})
