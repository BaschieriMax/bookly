import { addPhoneBooking, demo, expect, expectAccessible, login, test } from './fixtures'

/**
 * A Wednesday (demo staff work Monday–Saturday 09:00–13:00) far from the days the other specs
 * use, different for every project and retry: 09:00 is then free in every run.
 */
function freeWednesday(project: string, retry: number): string {
  const projects = ['mobile', 'desktop', 'firefox', 'iphone-webkit']
  const day = new Date()
  day.setDate(day.getDate() + 120 + 7 * Math.max(0, projects.indexOf(project)) + 28 * retry)
  while (day.getDay() !== 3) day.setDate(day.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

test('the owner finds a phone customer, corrects the number and erases the data', async ({
  page,
  browserName,
}, testInfo) => {
  const lastName = `Cliente${testInfo.project.name.replace(/\W/g, '')}${Date.now() % 100000}`
  await login(page, demo.owner)
  await addPhoneBooking(page, lastName, freeWednesday(testInfo.project.name, testInfo.retry))

  await page.goto('/admin/clienti')
  await expect(page.getByRole('heading', { name: 'Clienti', level: 1 })).toBeVisible()
  await page.getByLabel('Cerca per nome, telefono o email').fill(lastName)
  // Table on tablets and desktops, cards on phones: only one of them is visible.
  const row = page
    .getByRole('button', { name: new RegExp(`E2e ${lastName}`) })
    .filter({ visible: true })
    .first()
  await expect(row).toBeVisible()
  await expectAccessible(page)
  await row.click()

  const dialog = page.getByRole('dialog', { name: new RegExp(`E2e ${lastName}`) })
  await expect(dialog.getByRole('tab', { name: 'Dati' })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByLabel('Telefono')).toHaveValue('333 000 1234')
  if (browserName !== 'firefox') await expectAccessible(page)

  await dialog.getByRole('tab', { name: 'Appuntamenti (1)' }).click()
  await expect(dialog.getByRole('button', { name: 'Prossimi 1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(dialog.getByText('Confermato').filter({ visible: true })).toBeVisible()
  await expect(dialog.getByText('Mostrati 1 di 1')).toBeVisible()

  await dialog.getByRole('tab', { name: 'Dati' }).click()
  await dialog.getByLabel('Telefono').fill('333 000 9876')
  await dialog.getByRole('button', { name: 'Salva modifiche' }).click()
  await expect(page.getByText('Dati del cliente aggiornati.').first()).toBeVisible()

  await dialog.getByRole('button', { name: 'Cancella dati' }).click()
  const confirm = page.getByRole('alertdialog', { name: new RegExp(`Cancellare i dati di E2e`) })
  await expect(
    confirm.getByText(/Verranno annullati anche gli appuntamenti in programma/),
  ).toBeVisible()
  await confirm.getByRole('button', { name: 'Cancella dati' }).click()
  await expect(
    page.getByText('Dati del cliente cancellati e annullato 1 appuntamento futuro.').first(),
  ).toBeVisible()
  await expect(page.getByText('Nessun cliente trovato.')).toBeVisible()
})
