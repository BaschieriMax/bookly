import type { Page } from '@playwright/test'
import { demo, expect, test } from './fixtures'

/**
 * Every area must be reachable by clicking, starting from the landing page: the other specs open
 * pages by URL and could not notice a dead end (production finding: after login the landing
 * page had no way to the user's area).
 */

async function loginFromHome(page: Page, email: string) {
  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Menu del sito' })
    .getByRole('link', { name: 'Accedi' })
    .click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(demo.password)
  await page.getByRole('button', { name: 'Accedi', exact: true }).click()
}

/**
 * Below the md breakpoint (768 px) the admin/platform sidebar is a drawer. Decided by viewport,
 * not by probing the button: right after navigation the lazy shell may not be rendered yet.
 */
async function openMenuIfCollapsed(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByRole('button', { name: 'Apri il menu' }).click()
  }
}

test('an owner moves between their areas with clicks only', async ({ page }) => {
  await loginFromHome(page, demo.owner)
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible()

  await openMenuIfCollapsed(page)
  await page.getByRole('link', { name: 'Le mie prenotazioni' }).click()
  await expect(page).toHaveURL(/\/account\/appuntamenti$/)

  await page.getByRole('link', { name: 'Gestione attività' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible()

  await openMenuIfCollapsed(page)
  await page.getByRole('link', { name: 'Vedi pagina pubblica' }).click()
  await expect(page).toHaveURL(new RegExp(`/b/${demo.slug}$`))
  await expect(page.getByRole('link', { name: /prenota ora/i })).toBeVisible()
})

test('a super-admin lands on the platform area', async ({ page }) => {
  await loginFromHome(page, demo.superAdmin)
  await expect(page).toHaveURL(/\/platform\/tenant$/)
  await expect(page.getByRole('heading', { name: 'Attività', level: 1 })).toBeVisible()
})

test('a customer lands on their bookings and goes back to the landing page', async ({ page }) => {
  await loginFromHome(page, demo.customer)
  await expect(page).toHaveURL(/\/account\/appuntamenti$/)
  await expect(page.getByRole('link', { name: 'Gestione attività' })).toHaveCount(0)

  await page.getByRole('link', { name: 'bookly' }).click()
  await expect(page).toHaveURL(/\/$/)
  const menu = page.getByRole('navigation', { name: 'Menu del sito' })
  // Wide screens list every area; small ones show a single "La tua area" link.
  await expect(
    menu.getByRole('link', { name: /^(La tua area|Le mie prenotazioni)$/ }),
  ).toHaveAttribute('href', '/account/appuntamenti')

  await menu.getByRole('button', { name: 'Esci' }).click()
  await expect(menu.getByRole('link', { name: 'Accedi' })).toBeVisible()
})
