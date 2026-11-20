import { demo, expect, login, test } from './fixtures'

// TEMPORARY: bisects a Firefox "Page crashed" on page.evaluate with a dialog open. Removed after.
test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'firefox', 'Firefox only')
})

test('diag 1: calendar, evaluate', async ({ page }) => {
  await login(page, demo.owner)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible()
  expect(await page.evaluate(() => 1)).toBe(1)
})

test('diag 2: calendar, focused select, evaluate', async ({ page }) => {
  await login(page, demo.owner)
  await page.goto('/admin')
  await page.getByLabel('Operatore').focus()
  expect(await page.evaluate(() => 1)).toBe(1)
})

test('diag 3: services dialog (text field focused), evaluate', async ({ page }) => {
  await login(page, demo.owner)
  await page.goto('/admin/servizi')
  await page.getByRole('button', { name: /nuovo servizio/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => 1)).toBe(1)
})

test('diag 4: new appointment dialog, evaluate', async ({ page }) => {
  await login(page, demo.owner)
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Nuovo appuntamento' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => 1)).toBe(1)
})

test('diag 5: new appointment dialog, blur the select, evaluate', async ({ page }) => {
  await login(page, demo.owner)
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Nuovo appuntamento' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nota (facoltativa)').focus()
  expect(await page.evaluate(() => 1)).toBe(1)
})
