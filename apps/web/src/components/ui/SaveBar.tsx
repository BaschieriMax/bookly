import { useTranslation } from 'react-i18next'
import { Button } from './Button'

interface SaveBarProps {
  /** Shown only while there are unsaved changes (or a save is running). */
  visible: boolean
  saveLabel: string
  saving?: boolean
  saveDisabled?: boolean
  /** Inside a <form> leave it out: the button submits the form. */
  onSave?: () => void
  onDiscard: () => void
}

/**
 * Save bar of long forms (DEC-041): it slides in at the bottom of the screen as soon as something
 * changes, so the owner never has to scroll down to find "Salva", and it disappears once saved.
 * From 640 px it is sticky: at the end of the form it rests in place instead of covering the
 * content. On phones it is fixed to the bottom of the screen, Annulla and Salva side by side
 * (1/3 and 2/3); the shells leave room for it below the content.
 */
export function SaveBar({
  visible,
  saveLabel,
  saving = false,
  saveDisabled = false,
  onSave,
  onDiscard,
}: SaveBarProps) {
  const { t } = useTranslation('common')
  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex animate-sheet-up flex-col gap-2.5 border-t border-border bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-6px_16px_rgb(0_0_0/0.08)] sm:sticky sm:inset-x-auto sm:bottom-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-card sm:border sm:py-3 sm:shadow-lg">
      <p role="status" className="flex items-center gap-2 text-sm font-semibold text-warning">
        <span aria-hidden="true" className="size-2 rounded-pill bg-warning" />
        {t('unsavedChanges')}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 sm:flex">
        <Button variant="secondary" disabled={saving} onClick={onDiscard}>
          {t('discardChanges')}
        </Button>
        <Button
          type={onSave ? 'button' : 'submit'}
          loading={saving}
          disabled={saveDisabled}
          onClick={onSave}
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
