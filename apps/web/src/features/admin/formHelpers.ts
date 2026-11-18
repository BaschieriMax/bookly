import type { TFunction } from 'i18next'
import { z } from 'zod'

/**
 * Validation messages are stable keys ("required", "range:5:600"), translated by the page.
 * Bounds mirror the API validation attributes, which remain the source of truth.
 */
export const intField = (min: number, max: number) =>
  z
    .number({ error: 'number' })
    .int({ error: 'number' })
    .min(min, { error: `range:${min}:${max}` })
    .max(max, { error: `range:${min}:${max}` })

export const requiredText = (max: number) =>
  z.string().trim().min(1, { error: 'required' }).max(max, { error: 'tooLong' })

export const optionalText = (max: number) => z.string().trim().max(max, { error: 'tooLong' })

export function validationMessage(
  t: TFunction<'admin'>,
  key: string | undefined,
): string | undefined {
  if (!key) return undefined
  const [name = 'required', min, max] = key.split(':')
  return t(`errors.validation.${name}` as 'errors.validation.required', { min, max })
}

/** "12,50" or "12.5" → 1250 cents; empty → null (price on request). */
export function parsePriceCents(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  return Math.round(Number(trimmed.replace(',', '.')) * 100)
}

export function formatPriceInput(cents: number | null): string {
  if (cents === null) return ''
  const value = cents / 100
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
}

export const PRICE_PATTERN = /^\d{1,6}([.,]\d{1,2})?$/
