import { CalendarCheck } from 'lucide-react'
import { Link } from 'react-router'
import { paths } from '@/app/paths'

interface BooklyLogoProps {
  /** Landing page by default; the admin and platform shells link to their own home. */
  to?: string
  className?: string
  onClick?: () => void
}

/** Bookly wordmark (neutral platform brand, DEC-016). */
export function BooklyLogo({ to = paths.home, className = '', onClick }: BooklyLogoProps) {
  return (
    <Link to={to} onClick={onClick} className={`flex min-h-11 items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-control bg-primary text-primary-fg"
      >
        <CalendarCheck className="size-4" />
      </span>
      <span className="font-heading text-xl font-bold tracking-tight">bookly</span>
    </Link>
  )
}
