import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

async function fillForm(password: string) {
  await userEvent.type(await screen.findByLabelText('Nome'), 'Mario')
  await userEvent.type(screen.getByLabelText('Cognome'), 'Rossi')
  await userEvent.type(screen.getByLabelText('Email'), 'mario@example.test')
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: 'Crea account' }))
}

describe('RegisterPage', () => {
  it('validates required fields and the privacy checkbox', async () => {
    renderApp('/registrati')
    await userEvent.click(await screen.findByRole('button', { name: 'Crea account' }))

    expect(await screen.findByText('Inserisci il nome.')).toBeInTheDocument()
    expect(screen.getByText('La password deve avere almeno 10 caratteri.')).toBeInTheDocument()
    expect(screen.getByText("Devi accettare l'informativa per continuare.")).toBeInTheDocument()
  })

  it('shows "check your email" after registering', async () => {
    let body: unknown = null
    server.use(
      http.post('/api/auth/register', async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 202 })
      }),
    )
    renderApp('/registrati')

    await fillForm('una-password-lunga')

    expect(
      await screen.findByRole('heading', { name: 'Controlla la tua email' }),
    ).toBeInTheDocument()
    expect(body).toMatchObject({
      email: 'mario@example.test',
      acceptPrivacy: true,
      phoneNumber: null,
    })
  })

  it('maps Identity error codes from the API to the password field', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          {
            title: 'Validation',
            status: 400,
            errors: { password: ['PasswordRequiresUniqueChars'] },
          },
          { status: 400 },
        ),
      ),
    )
    renderApp('/registrati')

    await fillForm('aaaaaaaaaa')

    expect(await screen.findByText('Usa almeno 4 caratteri diversi.')).toBeInTheDocument()
  })
})
