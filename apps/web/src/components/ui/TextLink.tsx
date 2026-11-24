import { Link, type LinkProps } from 'react-router'

/**
 * Stand-alone text link (e.g. "Vai all'accesso" under a notice) with a 44 px touch target.
 * Links inside a sentence stay plain <Link>: WCAG 2.5.8 exempts inline targets.
 */
export function TextLink({ className = '', ...props }: LinkProps) {
  return (
    <Link
      className={`inline-flex min-h-11 items-center self-start font-semibold text-primary-text underline-offset-4 hover:underline ${className}`}
      {...props}
    />
  )
}
