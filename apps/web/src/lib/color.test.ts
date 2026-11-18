import { describe, expect, it } from 'vitest'
import { contrastRatio, isHexColor, readableOn } from './color'

describe('color', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#0f766e', '#ffffff')).toBeGreaterThan(4.5)
    expect(contrastRatio('#fde047', '#faf9f7')).toBeLessThan(3)
  })

  it('picks dark text on light brand colors and white on dark ones', () => {
    expect(readableOn('#e8b05a')).toBe('#1a1405')
    expect(readableOn('#0f766e')).toBe('#ffffff')
  })

  it('validates hex colors', () => {
    expect(isHexColor('#e8b05a')).toBe(true)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor(null)).toBe(false)
  })
})
