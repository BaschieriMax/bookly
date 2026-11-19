import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, it } from 'vitest'
import { demoTenant, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

it('offers a retry when the server cannot be reached', async () => {
  let calls = 0
  server.use(
    http.get('/api/public/tenants/barberia-demo', () => {
      calls++
      return calls === 1 ? HttpResponse.error() : HttpResponse.json(demoTenant)
    }),
  )
  renderApp('/b/barberia-demo')

  expect(
    await screen.findByRole(
      'heading',
      { name: 'Connessione assente o server non raggiungibile.' },
      { timeout: 5000 },
    ),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Riprova' }))

  expect(await screen.findByRole('link', { name: demoTenant.name })).toBeInTheDocument()
})
