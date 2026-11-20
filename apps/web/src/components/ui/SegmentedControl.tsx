interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group, e.g. "Mostra". */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  /** Stretch the buttons to the full width (phones). */
  fullWidth?: boolean
  className?: string
}

/**
 * A few mutually exclusive filters shown side by side ("Tutti / Rubrica / Con account").
 * Toggle buttons with aria-pressed: each one is reachable with Tab and announced as pressed.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  fullWidth = false,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`gap-1 rounded-card bg-subtle p-1 ${fullWidth ? 'flex' : 'inline-flex'} ${className}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`min-h-11 rounded-control px-3 text-sm font-semibold whitespace-nowrap text-muted aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm sm:px-4 ${fullWidth ? 'flex-auto' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
