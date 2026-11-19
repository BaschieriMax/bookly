import { demo, expect, login, test } from './fixtures'

test('a customer books a time, finds it in the account and cancels it', async ({ page }) => {
  await login(page, demo.customer)

  await page.goto(`/b/${demo.slug}`)
  await page.getByRole('link', { name: /prenota ora/i }).click()
  await expect(page.getByRole('heading', { name: 'Scegli il servizio' })).toBeVisible()
  await page
    .getByRole('button', { name: /Taglio/ })
    .first()
    .click()

  // Next month (always outside the cancellation window), first day with free times, first time.
  await page.getByRole('button', { name: 'Vai al mese successivo' }).click()
  await page.getByRole('grid').getByRole('button', { disabled: false }).first().click()
  const firstTime = page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first()
  await expect(firstTime).toBeVisible()
  const time = (await firstTime.textContent())!.trim()
  await firstTime.click()
  await page.getByRole('button', { name: 'Continua' }).click()
  await page.getByLabel(/note per l'operatore/i).fill('Prova end-to-end')
  await page.getByRole('button', { name: 'Conferma prenotazione' }).click()
  await expect(page.getByRole('heading', { name: 'Prenotazione confermata' })).toBeVisible()

  await page.goto('/account/appuntamenti')
  const card = page
    .getByRole('listitem')
    .filter({ hasText: time })
    .filter({ hasText: 'Barberia Demo' })
    .filter({ has: page.getByRole('button', { name: 'Disdici' }) })
    .first()
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Disdici' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sì, disdici' }).click()
  await expect(page.getByText('Appuntamento disdetto.').first()).toBeVisible()
})

test('the owner opens the calendar and the services', async ({ page }) => {
  await login(page, demo.owner)
  await page.goto('/admin?vista=settimana')
  await expect(page.getByRole('heading', { name: 'Calendario', level: 1 })).toBeVisible()
  await page.goto('/admin/servizi')
  await expect(page.getByRole('heading', { name: 'Servizi', level: 1 })).toBeVisible()
})
