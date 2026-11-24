import { useId, type Ref, type SelectHTMLAttributes } from 'react'
import { fieldClass, fieldLabelClass } from './fieldStyles'

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: readonly SelectOption[]
  error?: string
  hint?: string
  ref?: Ref<HTMLSelectElement>
}

/** Labelled native select fed by an options array. */
export function SelectField({
  label,
  options,
  error,
  hint,
  id,
  className = '',
  ref,
  ...props
}: SelectFieldProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined

  return (
    <div className={`group flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={selectId} className={fieldLabelClass}>
        {label}
      </label>
      <select
        id={selectId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-11 px-2 ${fieldClass(!!error)}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error && (
        <p id={`${selectId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${selectId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
