import { describe, expect, it } from 'vitest'
import { reportError, scrubBreadcrumb, scrubEvent, stripQuery } from './monitoring'

describe('monitoring', () => {
  it('drops query strings that may carry tokens', () => {
    expect(stripQuery('https://b.test/invito?userId=1&token=x')).toBe('https://b.test/invito')
    expect(stripQuery('/reimposta-password#t')).toBe('/reimposta-password')
    expect(stripQuery('/admin')).toBe('/admin')
  })

  it('removes the user, cookies, headers and URL tokens from events', () => {
    const event = scrubEvent({
      type: undefined,
      user: { email: 'mario@example.test' },
      request: {
        url: 'https://b.test/conferma-email?userId=1&token=secret',
        query_string: 'token=secret',
        cookies: { 'XSRF-TOKEN': 'x' },
        headers: { Cookie: 'x' },
      },
      breadcrumbs: [{ category: 'fetch', data: { url: '/api/auth/invitation?token=secret' } }],
    })

    expect(event.user).toBeUndefined()
    expect(event.request).toEqual({ url: 'https://b.test/conferma-email' })
    expect(event.breadcrumbs?.[0]?.data?.url).toBe('/api/auth/invitation')
    expect(
      scrubBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b' } }).data,
    ).toEqual({
      from: '/a',
      to: '/b',
    })
  })

  it('is a no-op without a DSN', () => {
    expect(() => reportError(new Error('boom'))).not.toThrow()
  })
})
