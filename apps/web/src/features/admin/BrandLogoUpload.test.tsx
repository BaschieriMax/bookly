import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { ownerMe, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'
import { createHomeScreenIcon } from '@/lib/homeScreenIcon'

// jsdom cannot draw images: the icon the browser would make is stubbed.
vi.mock('@/lib/homeScreenIcon', () => ({ createHomeScreenIcon: vi.fn() }))

const brandSettings = {
  primaryColor: '#e8b05a',
  ground: 'Dark',
  headingFont: 'Script',
  hasLogo: true,
}

function captureUpload() {
  const sent: { logo?: string; icon?: string | null } = {}
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(ownerMe)),
    http.put('/api/admin/brand/logo', async ({ request }) => {
      const form = await request.formData()
      sent.logo = (form.get('logo') as File | null)?.name
      const icon = form.get('icon') as File | null
      sent.icon = icon ? await icon.text() : null
      return HttpResponse.json(brandSettings)
    }),
  )
  return sent
}

async function uploadPng() {
  renderApp('/admin/brand')
  const input = await screen.findByLabelText('Carica logo')
  await userEvent.upload(input, new File(['png'], 'logo.png', { type: 'image/png' }))
  expect((await screen.findAllByText('Logo aggiornato.'))[0]).toBeInTheDocument()
}

describe('logo upload (DEC-043)', () => {
  it('sends the home-screen icon made from the logo', async () => {
    vi.mocked(createHomeScreenIcon).mockResolvedValue(new Blob(['icon-png'], { type: 'image/png' }))
    const sent = captureUpload()

    await uploadPng()

    expect(sent).toEqual({ logo: 'logo.png', icon: 'icon-png' })
  })

  it('still saves the logo when the browser cannot make the icon', async () => {
    vi.mocked(createHomeScreenIcon).mockResolvedValue(null)
    const sent = captureUpload()

    await uploadPng()

    expect(sent).toEqual({ logo: 'logo.png', icon: null })
  })
})
