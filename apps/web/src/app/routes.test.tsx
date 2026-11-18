import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

describe('routes', () => {
  it('renders the home page at /', async () => {
    renderAt('/')
    expect(
      await screen.findByRole('heading', { name: /prenotazioni online per attività locali/i }),
    ).toBeInTheDocument()
  })

  it('renders the not-found page for unknown paths', async () => {
    renderAt('/questa-pagina-non-esiste')
    expect(await screen.findByRole('heading', { name: /pagina non trovata/i })).toBeInTheDocument()
  })
})
