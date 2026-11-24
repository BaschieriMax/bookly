import { describe, expect, it } from 'vitest'
import { telHref } from './tel'

describe('telHref', () => {
  it('keeps only digits and a leading plus', () => {
    expect(telHref('333 1234567')).toBe('tel:3331234567')
    expect(telHref('059/123.45-67')).toBe('tel:0591234567')
    expect(telHref(' +39 059 000 0000')).toBe('tel:+390590000000')
  })
})
