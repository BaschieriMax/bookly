/**
 * Brand colors offered to tenants as quick picks (DEC-016). These are tenant data, not app
 * styling: the app palette lives in tokens.css. Any other #RRGGBB can be entered by hand.
 */
export const BRAND_SWATCHES = [
  { id: 'teal', value: '#0f766e' },
  { id: 'forest', value: '#2f6b4f' },
  { id: 'ochre', value: '#e8b05a' },
  { id: 'terracotta', value: '#c0583a' },
  { id: 'bordeaux', value: '#8c2f39' },
  { id: 'oldRose', value: '#c97b84' },
  { id: 'plum', value: '#6b3fa0' },
  { id: 'night', value: '#1e3a8a' },
  { id: 'graphite', value: '#3f3f46' },
] as const

export const BRAND_GROUNDS = ['Light', 'Dark'] as const
export const BRAND_FONTS = ['Script', 'Serif', 'Sans'] as const

export type BrandGround = (typeof BRAND_GROUNDS)[number]
export type BrandFont = (typeof BRAND_FONTS)[number]
