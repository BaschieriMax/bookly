import { useId, type InputHTMLAttributes, type Ref } from 'react'

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
  ref?: Ref<HTMLInputElement>
}

/** Checkbox with a 44px touch target and an optional description. */
export function CheckboxField({
  label,
  description,
  id,
  className = '',
  ref,
  ...props
}: CheckboxFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label
      htmlFor={inputId}
      className={`flex min-h-11 cursor-pointer items-start gap-3 py-2 ${className}`}
    >
      <input
        id={inputId}
        ref={ref}
        type="checkbox"
        aria-describedby={description ? `${inputId}-description` : undefined}
        className="mt-0.5 size-5 shrink-0 accent-primary"
        {...props}
      />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && (
          <span id={`${inputId}-description`} className="text-sm text-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}
