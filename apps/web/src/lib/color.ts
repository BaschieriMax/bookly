/** WCAG 2.x contrast helpers for tenant brand colors (DEC-016). */

const HEX = /^#([0-9a-f]{6})$/i

export function isHexColor(value: string | null | undefined): value is string {
  return !!value && HEX.test(value)
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Text color (near-black or white) with the best contrast on the given background. */
export function readableOn(background: string): string {
  const dark = '#1a1405'
  const light = '#ffffff'
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light
}
