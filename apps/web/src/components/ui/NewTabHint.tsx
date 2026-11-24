import { useTranslation } from 'react-i18next'

/**
 * " (si apre in una nuova scheda)" for screen readers, inside links with target="_blank".
 * The space is a text node of its own: a leading space inside the span is dropped by some
 * accessible-name computations.
 */
export function NewTabHint() {
  const { t } = useTranslation('common')
  return (
    <>
      {' '}
      <span className="sr-only">{t('newTab')}</span>
    </>
  )
}
