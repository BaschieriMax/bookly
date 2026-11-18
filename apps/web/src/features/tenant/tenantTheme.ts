import type { CSSProperties } from 'react'
import { contrastRatio, isHexColor, readableOn } from '@/lib/color'
import type { PublicTenant } from '@/types/api'

const grounds = {
  Light: {
    '--bk-color-bg': '#faf9f7',
    '--bk-color-surface': '#ffffff',
    '--bk-color-subtle': '#f2f0ec',
    '--bk-color-border': '#e2dfd9',
    '--bk-color-border-strong': '#8a867e',
    '--bk-color-ink': '#1a1917',
    '--bk-color-muted': '#57534c',
  },
  Dark: {
    '--bk-color-bg': '#151517',
    '--bk-color-surface': '#202023',
    '--bk-color-subtle': '#1b1b1e',
    '--bk-color-border': '#38383d',
    '--bk-color-border-strong': '#6b6b72',
    '--bk-color-ink': '#f4f1ea',
    '--bk-color-muted': '#b0aca3',
  },
} as const

const headingFonts = {
  Script: "'Great Vibes', cursive",
  Serif: "'Fraunces Variable', Georgia, serif",
  Sans: "'Space Grotesk Variable', 'Inter Variable', system-ui, sans-serif",
} as const

/**
 * CSS variables that re-skin the public pages with the tenant brand (DEC-016, DEC-018).
 * Only token values change: components keep using bg-primary, text-ink, font-tenant-heading...
 */
export function tenantThemeStyle(brand: PublicTenant['brand']): CSSProperties {
  const ground = brand.ground === 'Dark' ? grounds.Dark : grounds.Light
  const primary = isHexColor(brand.primaryColor) ? brand.primaryColor : '#0f766e'
  const primaryText =
    contrastRatio(primary, ground['--bk-color-bg']) >= 4.5 ? primary : ground['--bk-color-ink']
  const heading = headingFonts[brand.headingFont as keyof typeof headingFonts] ?? headingFonts.Sans

  return {
    ...ground,
    '--bk-color-primary': primary,
    '--bk-color-primary-hover': `color-mix(in srgb, ${primary} 85%, ${ground['--bk-color-ink']})`,
    '--bk-color-primary-fg': readableOn(primary),
    '--bk-color-primary-soft': `color-mix(in srgb, ${primary} 14%, ${ground['--bk-color-bg']})`,
    '--bk-color-primary-text': primaryText,
    '--bk-color-focus': primaryText,
    '--bk-font-tenant-heading': heading,
    colorScheme: brand.ground === 'Dark' ? 'dark' : 'light',
  } as unknown as CSSProperties
}
