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

/** WCAG 2.2 A/AA checks (overview §16); serious and critical violations fail the test. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
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

/** A phone booking for a new address-book customer, through the API the calendar dialog uses. */
export async function addPhoneBooking(page: Page, lastName: string, date: string) {
  const status = await page.evaluate(
    async ({ lastName, date }) => {
      const json = { Accept: 'application/json', 'Content-Type': 'application/json' }
      const services = (await (await fetch('/api/admin/services')).json()) as {
        id: string
        isActive: boolean
        staffIds: string[]
      }[]
      const service = services.find((s) => s.isActive && s.staffIds.length > 0)!
      const xsrf = decodeURIComponent(
        document.cookie
          .split('; ')
          .find((c) => c.startsWith('XSRF-TOKEN='))!
          .slice('XSRF-TOKEN='.length),
      )
      const response = await fetch('/api/admin/appointments', {
        method: 'POST',
        headers: { ...json, 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({
          serviceId: service.id,
          staffId: service.staffIds[0],
          date,
          time: '09:00',
          newCustomer: { firstName: 'E2e', lastName, phone: '333 000 1234', email: null },
          note: null,
          notifyCustomer: false,
          allowOutsideHours: true,
        }),
      })
      return response.status
    },
    { lastName, date },
  )
  expect(status).toBe(201)
}
