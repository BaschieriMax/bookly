import { describe, expect, it } from 'vitest'
import { SLUG_PATTERN, slugify } from './slug'

describe('slugify', () => {
  it('builds URL-safe slugs from business names', () => {
    expect(slugify('Sfumo Barber & Co.')).toBe('sfumo-barber-co')
    expect(slugify("L'Estetica di Città")).toBe('l-estetica-di-citta')
    expect(slugify('  --Già  Pronto--  ')).toBe('gia-pronto')
    expect(slugify('a'.repeat(60))).toHaveLength(40)
  })

  it('matches the API pattern', () => {
    expect(SLUG_PATTERN.test('sfumo-barber')).toBe(true)
    expect(SLUG_PATTERN.test('ab')).toBe(false)
    expect(SLUG_PATTERN.test('-sfumo')).toBe(false)
    expect(SLUG_PATTERN.test('Sfumo')).toBe(false)
  })
})
