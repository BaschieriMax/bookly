import { demo, expect, expectAccessible, login, test } from './fixtures'

/** A Tuesday at least five weeks ahead (demo staff work Monday–Saturday), as yyyy-MM-dd. */
function futureTuesday(): string {
  const day = new Date()
  day.setDate(day.getDate() + 35)
  while (day.getDay() !== 2) day.setDate(day.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

test('the owner enters a phone booking for a new customer from the calendar', async ({
  page,
}, testInfo) => {
  const lastName = `Prova${testInfo.project.name.replace(/\W/g, '')}${Date.now() % 100000}`
  await login(page, demo.owner)
  await page.goto(`/admin?data=${futureTuesday()}`)

  await page.getByRole('button', { name: 'Nuovo appuntamento' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuovo appuntamento' })
  await expect(dialog.getByRole('button', { pressed: true }).first()).toBeVisible()

  // First time that is free and inside the working hours (earlier runs may have taken some).
  const time = dialog.getByLabel('Ora')
  const free = await time
    .locator('option')
    .evaluateAll((options) =>
      options.map((o) => o.textContent ?? '').find((label) => /^\d{2}:\d{2}$/.test(label)),
    )
  expect(free).toBeDefined()
  await time.selectOption(free!)

  await dialog.getByRole('searchbox', { name: /Cerca cliente/ }).fill(`e2e ${lastName}`)
  await expect(dialog.getByText(/Nessun cliente trovato/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Nuovo cliente' }).click()
  await expect(dialog.getByLabel('Cognome')).toHaveValue(lastName)
  await dialog.getByLabel('Telefono').fill('333 000 1234')
  await expectAccessible(page)

  await dialog.getByRole('button', { name: 'Salva appuntamento' }).click()
  await expect(page.getByText('Appuntamento inserito.').first()).toBeVisible()
  await expect(dialog).toBeHidden()
  // The grid (desktop) or the agenda (phone) lists it; the other one is hidden.
  await expect(
    page
      .getByText(new RegExp(`E2e ${lastName}`))
      .filter({ visible: true })
      .first(),
  ).toBeVisible()
})
