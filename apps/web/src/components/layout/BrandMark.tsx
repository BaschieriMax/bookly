interface BrandMarkProps {
  className?: string
  /** Thicker strokes keep the mark readable at 14–16 px. */
  strokeWidth?: number
}

/**
 * Turnora mark (DEC-042): an arrow turning around the clock hands, «turno» + «ora».
 * Decorative and drawn with currentColor, so it follows the surrounding text color.
 * public/favicon.svg draws the same paths: keep them in sync.
 */
export function BrandMark({ className = '', strokeWidth = 2.25 }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
