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

test('e1 calendar staff filter options, no dialog', async ({ page }) => {
  await login(page, demo.owner)
  await page.goto('/admin')
  await page.waitForLoadState('networkidle')
  const n = await page
    .getByLabel('Operatore')
    .locator('option')
    .evaluateAll((o) => o.length)
  expect(n).toBeGreaterThan(0)
})

test('e2 axe on the customer picker', async ({ page }) => {
  await openLoaded(page)
  await new AxeBuilder({ page }).include('[role=dialog] section').analyze()
})

test('e3 axe on the staff pills', async ({ page }) => {
  await openLoaded(page)
  await new AxeBuilder({ page }).include('[role=dialog] fieldset').analyze()
})

test('e4 axe on textarea and checkboxes', async ({ page }) => {
  await openLoaded(page)
  await new AxeBuilder({ page })
    .include('[role=dialog] textarea')
    .include('[role=dialog] input[type=checkbox]')
    .analyze()
})

test('e5 axe on the dialog title', async ({ page }) => {
  await openLoaded(page)
  await new AxeBuilder({ page }).include('[role=dialog] h2').analyze()
})

test('e6 axe with the new service dialog open', async ({ page }) => {
  await login(page, demo.owner)
  await page.goto('/admin/servizi')
  await page.getByRole('button', { name: /nuovo servizio/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await new AxeBuilder({ page }).analyze()
})

test('e7 axe on the dialog footer', async ({ page }) => {
  await openLoaded(page)
  await new AxeBuilder({ page }).include('[role=dialog] > div:last-child').analyze()
})
