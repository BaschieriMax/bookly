import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PublicTenant } from '@/types/api'
import { useHomeScreenMeta } from './useHomeScreenMeta'

const tenant = (hasHomeIcon: boolean): PublicTenant => ({
  slug: 'barberia demo',
  name: 'Barberia Demo',
  phone: null,
  address: null,
  timeZone: 'Europe/Rome',
  cancellationWindowHours: 24,
  bookingHorizonDays: 60,
  brand: { primaryColor: null, ground: 'Light', headingFont: 'Sans', hasLogo: true, hasHomeIcon },
})

const icon = () => document.head.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')
const manifest = () => document.head.querySelector('link[rel="manifest"]')?.getAttribute('href')
const title = () =>
  document.head.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')

describe('useHomeScreenMeta', () => {
  beforeEach(() => {
    // The tags of index.html.
    document.head.innerHTML = `
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="apple-mobile-web-app-title" content="Turnora" />`
  })
  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('proposes the business name and icon, then puts Turnora back on leaving', () => {
    const { unmount } = renderHook(() => useHomeScreenMeta(tenant(true)))

    expect(icon()).toBe('/api/public/tenants/barberia%20demo/icon')
    expect(manifest()).toBe('/api/public/tenants/barberia%20demo/manifest.webmanifest')
    expect(title()).toBe('Barberia Demo')

    unmount()
    expect(icon()).toBe('/apple-touch-icon.png')
    expect(manifest()).toBe('/manifest.webmanifest')
    expect(title()).toBe('Turnora')
  })

  it('keeps the Turnora icon when the business has none', () => {
    renderHook(() => useHomeScreenMeta(tenant(false)))

    expect(icon()).toBe('/apple-touch-icon.png')
    expect(title()).toBe('Barberia Demo')
  })

  it('changes nothing while the business is loading', () => {
    renderHook(() => useHomeScreenMeta(undefined))

    expect(manifest()).toBe('/manifest.webmanifest')
    expect(title()).toBe('Turnora')
  })
})
