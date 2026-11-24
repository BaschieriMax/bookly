import { useId, type InputHTMLAttributes, type Ref } from 'react'
import { fieldClass, fieldLabelClass } from './fieldStyles'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  ref?: Ref<HTMLInputElement>
}

/** Labelled input with accessible error and hint messages. */
export function TextField({
  label,
  error,
  hint,
  id,
  className = '',
  ref,
  ...props
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`group flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className={fieldLabelClass}>
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`min-h-11 w-full min-w-0 px-3 read-only:bg-subtle read-only:text-muted read-only:hover:border-border-strong ${fieldClass(!!error)}`}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
