import { ChevronLeft, X } from 'lucide-react'
import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'

/** "Luca Bianchi" → "LB", "Barbiere 2" → "B2": the round avatar of people without a photo. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export function Avatar({ name, tone }: { name: string; tone: 'primary' | 'neutral' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-11 shrink-0 items-center justify-center rounded-pill text-sm font-bold ${
        tone === 'primary' ? 'bg-primary-soft text-primary-text' : 'bg-subtle text-muted'
      }`}
    >
      {initials(name)}
    </span>
  )
}

export function CloseButton({
  onClose,
  className = '',
}: {
  onClose: () => void
  className?: string
}) {
  const { t } = useTranslation('admin')
  return (
    <button
      type="button"
      data-dialog-close
      onClick={onClose}
      aria-label={t('actions.close')}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-subtle hover:text-ink ${className}`}
    >
      <X aria-hidden="true" className="size-5" />
    </button>
  )
}

interface StepHeaderProps {
  headingId: string
  headingRef: Ref<HTMLHeadingElement>
  title: string
  onBack: () => void
  onClose: () => void
}

/** Header of the "Sposta" and "Annulla" steps: back to the details, title, close. */
export function StepHeader({ headingId, headingRef, title, onBack, onClose }: StepHeaderProps) {
  const { t } = useTranslation('admin')
  return (
    <div className="flex shrink-0 items-center gap-1 px-3 pt-2 pb-1 md:px-4 md:pt-4">
      <button
        type="button"
        onClick={onBack}
        aria-label={t('calendar.actions.back')}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink transition-colors hover:bg-subtle"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="min-w-0 truncate font-heading text-xl font-semibold outline-none"
      >
        {title}
      </h2>
      <CloseButton onClose={onClose} className="ml-auto" />
    </div>
  )
}
