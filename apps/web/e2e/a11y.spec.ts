import { demo, expect, expectAccessible, login, test } from './fixtures'

const publicPages = [
  '/',
  '/login',
  '/registrati',
  '/password-dimenticata',
  '/privacy',
  `/b/${demo.slug}`,
  `/b/${demo.slug}/prenota`,
]

for (const path of publicPages) {
  test(`public page ${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expectAccessible(page)
  })
}

const ownerPages = [
  '/admin',
  '/admin/clienti',
  '/admin/servizi',
  '/admin/staff',
  '/admin/orari',
  '/admin/brand',
  '/admin/impostazioni',
]

test('admin pages have no serious accessibility violations', async ({ page }) => {
  await login(page, demo.owner)
  for (const path of ownerPages) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expectAccessible(page)
  }
})

test('customer and platform pages have no serious accessibility violations', async ({
  page,
  context,
}) => {
  await login(page, demo.customer)
  for (const path of ['/account/appuntamenti', '/account/profilo']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expectAccessible(page)
  }

  await context.clearCookies()
  await login(page, demo.superAdmin)
  for (const path of ['/platform/tenant', '/platform/navigazione']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expectAccessible(page)
  }
})
