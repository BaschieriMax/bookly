import { useId, type Ref, type TextareaHTMLAttributes } from 'react'
import { fieldClass, fieldLabelClass } from './fieldStyles'

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  ref?: Ref<HTMLTextAreaElement>
}

export function TextAreaField({
  label,
  error,
  id,
  className = '',
  ref,
  ...props
}: TextAreaFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={`group flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className={fieldLabelClass}>
        {label}
      </label>
      <textarea
        id={inputId}
        ref={ref}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`px-3 py-2 ${fieldClass(!!error)}`}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
