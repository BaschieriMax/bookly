import { demo, expect, expectAccessible, login, test } from './fixtures'

// DEC-039: the suspension dialog shows only how many future appointments there are and, when
// there are some, makes the super-admin choose. The test never confirms: the demo tenant must
// stay active for the other specs.
test('the suspension dialog asks what to do with the future appointments', async ({
  page,
  browserName,
}) => {
  await login(page, demo.superAdmin)
  await page.goto('/platform/tenant')
  const card = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Barberia Demo', exact: true }) })
  await card.getByRole('button', { name: 'Sospendi', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Sospendere «Barberia Demo»?' })
  await expect(dialog.getByText(/appuntament[oi] futur[oi]/).first()).toBeVisible()

  if ((await dialog.getByRole('radio').count()) > 0) {
    await expect(dialog.getByRole('radio', { name: 'Sospendi soltanto' })).not.toBeChecked()
    await dialog.getByRole('button', { name: 'Sospendi', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Scegli cosa fare con gli appuntamenti.')
  }

  // Same precaution as the "Nuovo appuntamento" dialog: Firefox under Playwright can crash when
  // axe reads the DOM with a dialog open.
  if (browserName !== 'firefox') await expectAccessible(page)

  await dialog.getByRole('button', { name: 'Annulla' }).click()
  await expect(dialog).toBeHidden()
  await expect(card.getByText('Attiva', { exact: true })).toBeVisible()
})
