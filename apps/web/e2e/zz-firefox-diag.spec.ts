import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { demo, expect, login, test } from './fixtures'

// TEMPORARY: bisects a Firefox "Page crashed" with the new appointment dialog open. Removed after.
test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'firefox', 'Firefox only')
})

async function openLoaded(page: Page) {
  await login(page, demo.owner)
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Nuovo appuntamento' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuovo appuntamento' })
  await expect(dialog.getByRole('button', { pressed: true }).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  return dialog
}

// Round 4: the date input has no "min" any more; these crashed before.
for (let round = 1; round <= 2; round++) {
  test(`f1 service options #${round}`, async ({ page }) => {
    const dialog = await openLoaded(page)
    const n = await dialog
      .getByLabel('Servizio')
      .locator('option')
      .evaluateAll((o) => o.length)
    expect(n).toBeGreaterThan(0)
  })

  test(`f2 time options #${round}`, async ({ page }) => {
    const dialog = await openLoaded(page)
    const n = await dialog
      .getByLabel('Ora')
      .locator('option')
      .evaluateAll((o) => o.length)
    expect(n).toBe(65)
  })

  test(`f3 axe on the whole page #${round}`, async ({ page }) => {
    await openLoaded(page)
    await new AxeBuilder({ page }).analyze()
  })
}
