import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ownerMe, ownerNavigation, platformNavigation, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'
import { knownRoutes } from './paths'
import { routes } from './routes'

function collectPaths(tree: RouteObject[]): string[] {
  return tree.flatMap((route) => [
    ...(route.path ? [route.path] : []),
    ...collectPaths(route.children ?? []),
  ])
}

describe('routes', () => {
  it('renders the home page at /', async () => {
    renderApp('/')
    expect(
      await screen.findByRole('heading', { name: /prenotazioni online per attività locali/i }),
    ).toBeInTheDocument()
  })

  it('renders the not-found page for unknown paths', async () => {
    renderApp('/questa-pagina-non-esiste')
    expect(await screen.findByRole('heading', { name: /pagina non trovata/i })).toBeInTheDocument()
  })

  it('declares every route the server may put in the sidebar (DEC-019)', () => {
    const declared = new Set(collectPaths(routes))
    const seeded = [...ownerNavigation, ...platformNavigation].map((item) => item.route)

    for (const route of [...knownRoutes, ...seeded]) {
      expect(declared, `route ${route}`).toContain(route)
    }
  })

  it('sends anonymous users to login, keeping where they wanted to go', async () => {
    const { router } = renderApp('/admin/servizi')

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?redirect=%2Fadmin%2Fservizi')
  })

  it('shows the server-driven sidebar to a tenant owner', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(ownerMe)))
    renderApp('/admin/servizi')

    const menu = await screen.findByRole('navigation', { name: "Menu dell'attività" })
    const links = await screen.findAllByRole('link', {
      name: /calendario|servizi|staff|orari|brand|impostazioni/i,
    })

    expect(menu).toBeInTheDocument()
    expect(links.map((l) => l.textContent)).toEqual([
      'Calendario',
      'Servizi',
      'Staff',
      'Orari e assenze',
      'Brand',
      'Impostazioni',
    ])
    expect(screen.getByRole('link', { name: 'Servizi' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('heading', { name: 'Servizi' })).toBeInTheDocument()
  })

  it('blocks the platform area for users who are not super-admins', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(ownerMe)))
    renderApp('/platform/tenant')

    expect(await screen.findByRole('heading', { name: /non hai i permessi/i })).toBeInTheDocument()
  })
})
