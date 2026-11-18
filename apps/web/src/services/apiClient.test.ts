import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { apiClient } from './apiClient'

describe('apiClient antiforgery priming', () => {
  afterEach(() => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('calls /auth/me once before unsafe requests when the XSRF cookie is missing', async () => {
    const calls: string[] = []
    server.use(
      http.get('/api/auth/me', () => {
        calls.push('me')
        return new HttpResponse(null, { status: 204 })
      }),
      http.post('/api/auth/confirm-email', () => {
        calls.push('post')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await Promise.all([
      apiClient.post('/auth/confirm-email', {}),
      apiClient.post('/auth/confirm-email', {}),
    ])

    expect(calls).toEqual(['me', 'post', 'post'])
  })

  it('does not prime when the cookie exists or for safe requests', async () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/'
    const calls: string[] = []
    server.use(
      http.get('/api/auth/me', () => {
        calls.push('me')
        return new HttpResponse(null, { status: 204 })
      }),
      http.post('/api/auth/confirm-email', () => {
        calls.push('post')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await apiClient.post('/auth/confirm-email', {})
    await apiClient.get('/auth/me')

    expect(calls).toEqual(['post', 'me'])
  })
})
