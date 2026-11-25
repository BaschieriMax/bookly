// Generates the Turnora home-screen icons in public/ from the brand mark (DEC-042, DEC-043).
// Run after changing the mark: `npm run icons` (set PW_CHROMIUM_PATH if Playwright's own
// browser is not installed). The paths below are the ones in src/components/layout/BrandMark.tsx
// and public/favicon.svg: keep the three in sync.
//
// Home-screen icons are full-bleed squares with no transparency: iOS paints transparent pixels
// black and applies its own rounded mask; Android crops maskable icons to the central 80% circle,
// and the mark (56% of the side) stays inside it.
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const TEAL = '#0f766e'
const MARK_PATHS = [
  'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8',
  'M21 3v5h-5',
  'M12 7v5l3 2',
]
const MARK_RATIO = 0.56

const ICONS = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
]

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public')

function iconSvg(size) {
  const mark = size * MARK_RATIO
  const offset = (size - mark) / 2
  const scale = mark / 24
  const paths = MARK_PATHS.map((d) => `<path d="${d}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${TEAL}"/>
<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>`
}

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
)
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const { file, size } of ICONS) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<html><body style="margin:0">${iconSvg(size)}</body></html>`)
    await page.locator('svg').screenshot({ path: path.join(publicDir, file) })
    console.log(`public/${file} (${size}×${size})`)
  }
} finally {
  await browser.close()
}
