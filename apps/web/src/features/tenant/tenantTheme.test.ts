import { describe, expect, it } from 'vitest'
import { tenantThemeStyle } from './tenantTheme'

type Vars = Record<string, string>

describe('tenantThemeStyle', () => {
  it('uses the brand color on dark grounds with readable text on buttons', () => {
    const style = tenantThemeStyle({
      primaryColor: '#e8b05a',
      ground: 'Dark',
      headingFont: 'Script',
      hasLogo: false,
    }) as Vars

    expect(style['--bk-color-primary']).toBe('#e8b05a')
    expect(style['--bk-color-primary-fg']).toBe('#1a1405')
    expect(style['--bk-color-primary-text']).toBe('#e8b05a')
    expect(style['--bk-font-tenant-heading']).toBe('var(--bk-font-brand-script)')
  })

  it('falls back to the ink color for text when the brand color is too light', () => {
    const style = tenantThemeStyle({
      primaryColor: '#fde047',
      ground: 'Light',
      headingFont: 'Sans',
      hasLogo: false,
    }) as Vars

    expect(style['--bk-color-primary-text']).toBe('#1a1917')
  })

  it('ignores invalid colors', () => {
    const style = tenantThemeStyle({
      primaryColor: 'red;}body{display:none',
      ground: 'Light',
      headingFont: 'Sans',
      hasLogo: false,
    }) as Vars

    expect(style['--bk-color-primary']).toBe('#0f766e')
  })
})
