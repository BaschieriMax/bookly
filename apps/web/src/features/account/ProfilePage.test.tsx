import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '@/types/api'
import { customerMe, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

const profile: Profile = {
  email: 'cliente@bookly.local',
  firstName: 'Cliente',
  lastName: 'Demo',
  phoneNumber: null,
  createdAt: '2026-11-01T10:00:00Z',
}

// Test-only inputs for the confirmation field (not credentials of any real account).
const CORRECT_INPUT = 'frase-di-prova-abbastanza-lunga'
const WRONG_INPUT = 'frase-diversa'

const signedIn = () =>
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(customerMe)),
    http.get('/api/me/profile', () => HttpResponse.json(profile)),
  )

describe('ProfilePage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('corrects the profile', async () => {
    signedIn()
    let body: unknown = null
    server.use(
      http.put('/api/me/profile', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...profile, ...(body as object) })
      }),
    )
    renderApp('/account/profilo')

    const phone = await screen.findByLabelText('Telefono', {}, { timeout: 5000 })
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    await userEvent.type(phone, 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(await screen.findByText('Inserisci un numero di telefono valido.')).toBeInTheDocument()

    await userEvent.clear(phone)
    await userEvent.type(phone, '333 1234567')
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))

    expect((await screen.findAllByText('Profilo aggiornato.'))[0]).toBeInTheDocument()
    expect(body).toEqual({ firstName: 'Cliente', lastName: 'Demo', phoneNumber: '333 1234567' })
  })

  it('downloads the data export', async () => {
    signedIn()
    server.use(
      http.get(
        '/api/me/export',
        () =>
          new HttpResponse('{"account":{}}', {
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': 'attachment; filename=turnora-dati-2026-11-18.json',
            },
          }),
      ),
    )
    const createObjectURL = vi.fn(() => 'blob:export')
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderApp('/account/profilo')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Scarica i miei dati' }, { timeout: 5000 }),
    )

    expect((await screen.findAllByText('File scaricato.'))[0]).toBeInTheDocument()
    expect(createObjectURL).toHaveBeenCalledOnce()
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('turnora-dati-2026-11-18.json')
  })

  it('asks the password and deletes the account', async () => {
    signedIn()
    let deleted = false
    server.use(
      http.get('/api/auth/me', () =>
        deleted ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(customerMe),
      ),
      http.post('/api/me/delete', async ({ request }) => {
        const body = (await request.json()) as Record<string, string>
        if (body.password !== CORRECT_INPUT) {
          return HttpResponse.json(
            { title: 'Wrong', status: 400, code: 'account.invalid_password' },
            { status: 400 },
          )
        }
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { router } = renderApp('/account/profilo')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Elimina il mio account' }, { timeout: 5000 }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: "Eliminare definitivamente l'account?",
    })
    const field = within(dialog).getByLabelText('Inserisci la password per confermare')
    await userEvent.type(field, WRONG_INPUT)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Elimina account' }))
    expect(await within(dialog).findByText('Password non corretta.')).toBeInTheDocument()

    await userEvent.clear(field)
    await userEvent.type(field, CORRECT_INPUT)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Elimina account' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect((await screen.findAllByText(/Account eliminato/))[0]).toBeInTheDocument()
  })
})

describe('Legal pages', () => {
  it('shows the privacy policy as a draft, linked from the footer', async () => {
    renderApp('/privacy')

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Informativa privacy e cookie' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/Bozza da far validare/)
    expect(
      screen.getByRole('heading', { name: 'Cookie e archiviazione nel browser' }),
    ).toBeInTheDocument()

    const footer = screen.getByRole('navigation', { name: 'Informazioni legali' })
    await userEvent.click(within(footer).getByRole('link', { name: 'Termini di servizio' }))
    expect(
      await screen.findByRole('heading', { name: 'Termini di servizio', level: 1 }),
    ).toBeInTheDocument()
  })
})
