import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/renderApp'

describe('TenantPage', () => {
  it('shows the business with its services and brand colors', async () => {
    const { container } = renderApp('/b/barberia-demo')

    expect(await screen.findByRole('link', { name: 'Barberia Demo' })).toBeInTheDocument()
    expect(await screen.findByText('Taglio')).toBeInTheDocument()
    expect(screen.getByText('25 €')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /prenota ora/i })).toHaveAttribute(
      'href',
      '/b/barberia-demo/prenota',
    )

    const themed = container.querySelector<HTMLElement>('[style*="--bk-color-primary"]')
    expect(themed?.style.getPropertyValue('--bk-color-primary')).toBe('#e8b05a')
    expect(themed?.style.getPropertyValue('--bk-color-bg')).toBe('#151517')
  })

  it('links each service to the booking wizard with the service preselected', async () => {
    renderApp('/b/barberia-demo')

    const link = await screen.findByRole('link', { name: /taglio/i })
    expect(link).toHaveAttribute(
      'href',
      '/b/barberia-demo/prenota?servizio=11111111-1111-4111-8111-111111111111',
    )
  })

  it('shows a not-found page for unknown businesses', async () => {
    renderApp('/b/non-esiste')

    expect(
      await screen.findByRole('heading', { name: 'Attività non trovata.' }),
    ).toBeInTheDocument()
  })
})
