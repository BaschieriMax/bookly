import type { Page } from '@playwright/test'
import { demo, expect, login, test } from './fixtures'

/**
 * Responsive checks for every role, from the smallest phone to a tablet (finding: at 320 px the
 * account header wrapped onto three rows). On every page and width:
 * - no horizontal scrolling;
 * - the top bar stays on one row;
 * - buttons, tabs and fields are at least 44 px tall (touch), stand-alone links at least 24 px
 *   (WCAG 2.5.8); links inside a sentence are exempt, as WCAG allows.
 * Runs in the touch projects only (Chromium on Android, WebKit on iPhone).
 */

const widths = [320, 390, 768]

/** One row of 44 px controls plus padding; a wrapped row is at least ~100 px. */
const MAX_TOP_BAR_PX = 88

const roles: Record<string, { email?: string; paths: string[] }> = {
  visitor: {
    paths: [
      '/',
      '/login',
      '/registrati',
      '/password-dimenticata',
      '/privacy',
      `/b/${demo.slug}`,
      `/b/${demo.slug}/prenota`,
    ],
  },
  customer: {
    email: demo.customer,
    paths: ['/', '/account/appuntamenti', '/account/profilo', `/b/${demo.slug}`],
  },
  owner: {
    email: demo.owner,
    paths: [
      '/admin',
      '/admin?vista=settimana',
      '/admin/servizi',
      '/admin/staff',
      '/admin/orari',
      '/admin/brand',
      '/admin/impostazioni',
      '/account/appuntamenti',
    ],
  },
  superAdmin: {
    email: demo.superAdmin,
    paths: ['/platform/tenant', '/platform/navigazione', '/account/appuntamenti'],
  },
}

/** Layout problems of the current page, as readable lines (empty = fine). */
function layoutProblems(page: Page) {
  const width = page.viewportSize()!.width
  return page.evaluate(
    ({ width, maxTopBar }) => {
      const problems: string[] = []

      // Mobile browsers zoom out a page wider than the screen: innerWidth grows with it, so
      // compare against the device width, not innerWidth.
      if (window.innerWidth > width) problems.push(`page zoomed out to ${window.innerWidth}px`)
      const overflow = document.documentElement.scrollWidth - width
      if (overflow > 0) problems.push(`horizontal scroll: ${overflow}px`)

      const shown = (el: Element) => {
        const r = el.getBoundingClientRect()
        return (
          r.width > 1 &&
          r.height > 1 &&
          getComputedStyle(el).visibility !== 'hidden' &&
          !el.closest('[aria-hidden="true"], [inert]')
        )
      }
      const label = (el: Element) =>
        `${el.tagName.toLowerCase()} "${((el as HTMLElement).innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`

      for (const bar of document.querySelectorAll('header')) {
        const r = bar.getBoundingClientRect()
        if (shown(bar) && Math.abs(r.top + window.scrollY) < 1 && r.height > maxTopBar) {
          problems.push(`top bar ${Math.round(r.height)}px tall (wrapped?)`)
        }
      }

      const controls = document.querySelectorAll(
        'button, [role="tab"], [role="radio"], select, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), a[href]',
      )
      for (const el of controls) {
        if (!shown(el) || el.closest('[data-time-grid]')) continue
        const r = el.getBoundingClientRect()
        if (el.tagName === 'A') {
          if (getComputedStyle(el).display === 'inline') continue // link inside a sentence
          if (r.height < 24 - 0.5 || r.width < 24 - 0.5) {
            problems.push(`small link ${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`)
          }
          continue
        }
        // A month grid on a 320 px phone leaves 40 px per day (7 columns); 44 px elsewhere.
        const min = el.closest('[role="grid"]') ? 40 : 44
        if (r.height < min - 0.5) {
          problems.push(`small control ${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`)
        }
      }
      return problems
    },
    { width, maxTopBar: MAX_TOP_BAR_PX },
  )
}

async function expectGoodLayout(page: Page, where: string) {
  await page.waitForLoadState('networkidle')
  expect.soft(await layoutProblems(page), where).toEqual([])
}

test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, 'Touch layouts only (projects "mobile" and "iphone-webkit").')
})

for (const [role, { email, paths }] of Object.entries(roles)) {
  test(`${role}: every page fits small screens`, async ({ page }) => {
    if (email) await login(page, email)
    for (const width of widths) {
      await test.step(`${width}px`, async () => {
        await page.setViewportSize({ width, height: 800 })
        for (const path of paths) {
          await page.goto(path)
          await expect(page.getByRole('heading').first()).toBeVisible()
          await expectGoodLayout(page, `${role} ${path} @ ${width}px`)
        }
      })
    }
  })
}

test('booking steps fit small screens', async ({ page }) => {
  for (const width of widths) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(`/b/${demo.slug}/prenota`)
      await page
        .getByRole('button', { name: /^Taglio/ })
        .first()
        .click()
      await expect(page.getByRole('grid')).toBeVisible()
      await expectGoodLayout(page, `days @ ${width}px`)
      // First day with free times (today may already be over).
      await page.locator('[role="grid"] button:not([disabled])').first().click()
      await expect(page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first()).toBeVisible()
      await expectGoodLayout(page, `times @ ${width}px`)
    })
  }
})

test('the account menu keeps the header on one row and opens inside the screen', async ({
  page,
}) => {
  await login(page, demo.owner)
  for (const width of [320, 390]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/account/appuntamenti')
      const toggle = page.getByRole('button', { name: 'Menu', exact: true })
      await toggle.click()
      const panel = page.getByRole('navigation', { name: 'Altre aree' })
      await expect(panel.getByRole('link', { name: 'Gestione attività' })).toBeVisible()
      const box = (await panel.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      await page.keyboard.press('Escape')
      await expect(panel).toBeHidden()
      await expect(toggle).toBeFocused()
    })
  }
})
