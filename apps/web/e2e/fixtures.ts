import AxeBuilder from '@axe-core/playwright'
import { expect, test as base, type Page } from '@playwright/test'

/** Demo accounts created by DemoDataSeeder (README). */
export const demo = {
  password: process.env.E2E_DEMO_PASSWORD ?? 'bookly-demo-2026',
  customer: 'cliente@bookly.local',
  owner: 'titolare@bookly.local',
  superAdmin: 'admin@bookly.local',
  slug: 'barberia-demo',
}

/**
 * Every test fails on console errors and CSP violations: a blocked script or style would
 * otherwise go unnoticed until production.
 */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`)
      })
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`)
        })
      })
      await use(problems)
      expect(problems, problems.join('\n')).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(demo.password)
  await page.getByRole('button', { name: 'Accedi', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

/** WCAG 2.1 A/AA checks; serious and critical violations fail the test. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    blocking.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
}
