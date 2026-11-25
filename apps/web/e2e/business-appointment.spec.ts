import { demo, expect, expectAccessible, login, test } from './fixtures'

/**
 * A Tuesday (demo staff work Monday–Saturday 09:00–13:00) far beyond the month the booking spec
 * uses, different for every project and retry: 09:00 is then free in every run.
 */
function freeTuesday(project: string, retry: number): string {
  const projects = ['mobile', 'desktop', 'firefox', 'iphone-webkit']
  const day = new Date()
  day.setDate(day.getDate() + 70 + 7 * Math.max(0, projects.indexOf(project)) + 28 * retry)
  while (day.getDay() !== 2) day.setDate(day.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

test('the owner enters a phone booking for a new customer from the calendar', async ({
  page,
  browserName,
}, testInfo) => {
  const lastName = `Prova${testInfo.project.name.replace(/\W/g, '')}${Date.now() % 100000}`
  await login(page, demo.owner)
  await page.goto(`/admin?data=${freeTuesday(testInfo.project.name, testInfo.retry)}`)

  await page.getByRole('button', { name: 'Nuovo appuntamento' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuovo appuntamento' })
  await expect(dialog.getByRole('button', { pressed: true }).first()).toBeVisible()

  await dialog.getByLabel('Ora').selectOption('09:00')
  await expect(dialog.getByText(/Fuori dall'orario/)).toBeHidden()
  await expect(dialog.getByRole('alert')).toBeHidden()

  await dialog.getByRole('searchbox', { name: /Cerca cliente/ }).fill(`e2e ${lastName}`)
  await expect(dialog.getByText(/Nessun cliente trovato/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Nuovo cliente' }).click()
  await expect(dialog.getByLabel('Cognome')).toHaveValue(lastName)
  await dialog.getByLabel('Telefono').fill('333 000 1234')
  // Playwright's Firefox crashes the page when a script reads the DOM with this dialog open
  // (axe, or reading the <option> elements); clicks and typing work. Bisected in CI on PR #34:
  // not caused by a single element. The check runs on Chromium and WebKit.
  if (browserName !== 'firefox') await expectAccessible(page)

  await dialog.getByRole('button', { name: 'Salva appuntamento' }).click()
  await expect(page.getByText('Appuntamento inserito.').first()).toBeVisible()
  await expect(dialog).toBeHidden()
  // The grid (desktop) or the agenda (phone) lists it; the other one is hidden.
  const listed = page
    .getByRole('button', { name: new RegExp(`E2e ${lastName}`) })
    .filter({ visible: true })
    .first()
  await expect(listed).toBeVisible()

  // Details sheet (DEC-044): move it to one of the free times, then cancel it.
  await listed.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toHaveAccessibleName(/^Appuntamento 09:00/)
  await sheet.getByRole('button', { name: 'Sposta' }).click()
  await expect(sheet).toHaveAccessibleName('Sposta appuntamento')
  const morning = sheet.getByRole('group', { name: 'Mattina' })
  await morning.getByRole('button', { name: '11:00' }).click()
  if (browserName !== 'firefox') await expectAccessible(page)
  await sheet.getByRole('button', { name: /^Sposta a .* · 11:00$/ }).click()
  await expect(page.getByText(/^Appuntamento spostato a .*, 11:00\.$/).first()).toBeVisible()
  await expect(sheet).toBeHidden()

  await listed.click()
  await expect(sheet).toHaveAccessibleName(/^Appuntamento 11:00/)
  await sheet.getByRole('button', { name: 'Annulla appuntamento' }).click()
  await sheet.getByRole('button', { name: 'Chiusura imprevista' }).click()
  await expect(sheet.getByLabel(/^Motivo/)).toHaveValue('Chiusura imprevista.')
  await sheet.getByRole('button', { name: 'Sì, annulla' }).click()
  await expect(page.getByText('Appuntamento annullato.').first()).toBeVisible()
  // Cancelled appointments are hidden unless the filter shows them.
  await expect(listed).toBeHidden()
})
