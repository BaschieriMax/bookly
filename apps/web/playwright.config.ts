import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against the real stack: the API serving the production build of the SPA
 * (same origin, CSP active) on a database with the demo data (DEC-031).
 * Locally: see README "Test end-to-end". In CI: the e2e job in ci.yml.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5080',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Chromium runs everywhere (locally PW_CHROMIUM_PATH can point to an installed build);
  // Firefox and Safari's engine (WebKit, on an iPhone profile) run in CI.
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'] } },
  ],
})
