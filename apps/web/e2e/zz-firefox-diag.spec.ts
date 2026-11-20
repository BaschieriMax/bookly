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

test('d1 service options', async ({ page }) => {
  const dialog = await openLoaded(page)
  const n = await dialog
    .getByLabel('Servizio')
    .locator('option')
    .evaluateAll((o) => o.length)
  expect(n).toBeGreaterThan(0)
})

test('d2 time options', async ({ page }) => {
  const dialog = await openLoaded(page)
  const n = await dialog
    .getByLabel('Ora')
    .locator('option')
    .evaluateAll((o) => o.length)
  expect(n).toBe(65)
})

test('d3 axe on the date input only', async ({ page }) => {
  await openLoaded(page)
  await new AxeBuilder({ page }).include('[role=dialog] input[type=date]').analyze()
})

test('d4 axe on the dialog without the date input', async ({ page }) => {
  await openLoaded(page)
  await new AxeBuilder({ page }).include('[role=dialog]').exclude('input[type=date]').analyze()
})

test('d5 axe on the dialog selects only', async ({ page }) => {
  await openLoaded(page)
  await new AxeBuilder({ page }).include('[role=dialog] select').analyze()
})

test('d6 computed style of every element', async ({ page }) => {
  await openLoaded(page)
  const n = await page.evaluate(
    () => [...document.querySelectorAll('*')].map((e) => getComputedStyle(e).color).length,
  )
  expect(n).toBeGreaterThan(0)
})

test('d7 axe on the calendar behind, dialog excluded', async ({ page }) => {
  await openLoaded(page)
  await new AxeBuilder({ page }).exclude('[role=dialog]').analyze()
})
