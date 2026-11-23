import { useId } from 'react'

export interface RadioCardOption<TValue extends string> {
  value: TValue
  label: string
  description?: string
}

interface RadioCardGroupProps<TValue extends string> {
  legend: string
  options: readonly RadioCardOption<TValue>[]
  /** Null: nothing chosen yet (no default on purpose, e.g. before a destructive action). */
  value: TValue | null
  onChange: (value: TValue) => void
  /** Shown under the options and announced; links the group to the message. */
  error?: string
}

/**
 * Native radio buttons laid out as cards: the whole card is the label (44px+ target), the
 * selected one is highlighted, keyboard arrows work as with any radio group.
 */
export function RadioCardGroup<TValue extends string>({
  legend,
  options,
  value,
  onChange,
  error,
}: RadioCardGroupProps<TValue>) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      className="flex min-w-0 flex-col gap-2.5"
    >
      <legend className="mb-2.5 font-semibold">{legend}</legend>
      {options.map((option) => {
        const selected = option.value === value
        const labelId = `${id}-${option.value}-label`
        const descriptionId = `${id}-${option.value}-description`
        return (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-control border p-3.5 ${
              selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'
            }`}
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              // The title names the option; the description is read after it, not as part of the name.
              aria-labelledby={labelId}
              aria-describedby={option.description ? descriptionId : undefined}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-1">
              <span id={labelId} className="font-semibold">
                {option.label}
              </span>
              {option.description && (
                <span id={descriptionId} className="text-sm text-muted">
                  {option.description}
                </span>
              )}
            </span>
          </label>
        )
      })}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}
