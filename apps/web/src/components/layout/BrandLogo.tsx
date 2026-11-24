import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { BrandMark } from './BrandMark'

interface BrandLogoProps {
  /** Landing page by default; the admin and platform shells link to their own home. */
  to?: string
  className?: string
  onClick?: () => void
}

/** Turnora wordmark: the neutral platform brand (DEC-016, DEC-042). */
export function BrandLogo({ to = paths.home, className = '', onClick }: BrandLogoProps) {
  return (
    <Link to={to} onClick={onClick} className={`flex min-h-11 items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-control bg-primary text-primary-fg"
      >
        <BrandMark className="size-4.5" />
      </span>
      <span className="font-heading text-xl font-bold tracking-tight">turnora</span>
    </Link>
  )
}
