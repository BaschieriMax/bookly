/**
 * Shared look of text inputs, selects and textareas (DEC-041): the border darkens on hover and,
 * on focus, a 3 px ring in the brand color grows in (150 ms, off with prefers-reduced-motion).
 * Only semantic tokens: on the public tenant pages the ring follows the tenant's colors.
 * The ring replaces the square outline of the base layer, the border change keeps focus visible.
 */
const base =
  'rounded-control border bg-surface text-ink transition-[border-color,box-shadow] duration-150 ease-out focus:outline-none focus:ring-3 disabled:cursor-not-allowed disabled:opacity-60'

const valid = 'border-border-strong hover:border-ink/60 focus:border-primary focus:ring-primary/25'
const invalid = 'border-danger focus:border-danger focus:ring-danger/20'

/** Classes of a field control; `hasError` switches to the danger border and ring. */
export function fieldClass(hasError = false): string {
  return `${base} ${hasError ? invalid : valid}`
}

/** Label above a field: it takes the brand color while the field has focus (needs `group` on the wrapper). */
export const fieldLabelClass =
  'text-sm font-semibold transition-colors duration-150 group-focus-within:text-primary-text'
