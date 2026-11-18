import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ownerMe, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'
import { safeRedirect } from './safeRedirect'

describe('LoginPage', () => {
  it('validates the form before calling the API', async () => {
    renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Accedi' }))

    expect(await screen.findByText('Inserisci la tua email.')).toBeInTheDocument()
    expect(screen.getByText('Inserisci la password.')).toBeInTheDocument()
  })

  it('shows the translated error for wrong credentials', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { title: 'Invalid', status: 401, code: 'auth.invalid_credentials' },
          { status: 401 },
        ),
      ),
    )
    renderApp('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'mario@example.test')
    await userEvent.type(screen.getByLabelText('Password'), 'sbagliata-123')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o password non corrette.')
  })

  it('logs in and goes back to the requested page', async () => {
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
    const { router } = renderApp('/login?redirect=%2Fadmin%2Fstaff')

    await userEvent.type(await screen.findByLabelText('Email'), 'titolare@bookly.local')
    await userEvent.type(screen.getByLabelText('Password'), 'bookly-demo-2026')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    expect(await screen.findByRole('heading', { name: 'Staff' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/staff')
  })

  it.each([
    ['/admin', '/admin'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    [null, '/'],
  ])('only allows internal redirects (%s → %s)', (target, expected) => {
    expect(safeRedirect(target)).toBe(expected)
  })
})
