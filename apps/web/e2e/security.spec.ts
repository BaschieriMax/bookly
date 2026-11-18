import { demo, expect, test } from './fixtures'

test('the SPA is served with security headers and a strict CSP', async ({ request }) => {
  for (const path of ['/', '/login', `/b/${demo.slug}`, '/api/health']) {
    const response = await request.get(path)
    const headers = response.headers()
    expect(headers['content-security-policy'], path).toContain("script-src 'self'")
    expect(headers['content-security-policy'], path).toContain("frame-ancestors 'none'")
    expect(headers['x-content-type-options'], path).toBe('nosniff')
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin')
  }
})

test('business pages carry their own title and Open Graph tags', async ({ request, page }) => {
  const html = await (await request.get(`/b/${demo.slug}`)).text()
  expect(html).toContain('<meta property="og:title" content="Barberia Demo" />')
  expect(html).toMatch(/<title>Barberia Demo · Prenota online<\/title>/)

  const missing = await request.get('/b/non-esiste')
  expect(missing.status()).toBe(404)
  expect(await missing.text()).toContain('noindex')

  await page.goto(`/b/${demo.slug}`)
  await expect(page.getByRole('link', { name: 'Barberia Demo' })).toBeVisible()
})
