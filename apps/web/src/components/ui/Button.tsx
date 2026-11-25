import type { ButtonHTMLAttributes, Ref } from 'react'
import { LoaderCircle } from 'lucide-react'

type Variant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'dangerSolid'
  | 'success'
  | 'warning'
  | 'ghost'
  | 'ghostDanger'

// Hover only on enabled buttons: a disabled "Salva" must not look clickable (DEC-041).
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg enabled:hover:bg-primary-hover',
  secondary:
    'border border-border-strong bg-surface text-ink enabled:hover:border-ink/60 enabled:hover:bg-subtle',
  danger: 'border border-danger bg-surface text-danger enabled:hover:bg-danger-soft',
  // Final confirmation of something that cannot be undone ("Sì, annulla").
  dangerSolid: 'bg-danger text-white enabled:hover:brightness-90',
  // Outcome of an appointment (DEC-044): "Completato" and "Non presentato".
  success: 'bg-success text-white enabled:hover:brightness-90',
  warning: 'border border-warning bg-warning-soft text-warning enabled:hover:brightness-95',
  ghost: 'text-ink enabled:hover:bg-subtle',
  // Icon buttons that delete something: neutral at rest, red on hover.
  ghostDanger: 'text-muted enabled:hover:bg-danger-soft enabled:hover:text-danger',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  // A padding passed in className replaces the default one: two px-* utilities on one element
  // would be decided by the order of the generated CSS, not by the order of the classes.
  const padding = /(^|\s)p[xl]?-/.test(className) ? '' : 'px-4'

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control ${padding} font-semibold transition-[background-color,border-color,color,transform] duration-150 enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  )
}
