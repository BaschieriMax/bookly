import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'

/** Links to the legal pages, shown at the bottom of public and customer pages. */
export function LegalFooter({ className = '' }: { className?: string }) {
  const { t } = useTranslation('legal')
  return (
    <footer className={`border-t border-border px-6 py-4 text-sm text-muted ${className}`}>
      <nav
        aria-label={t('footer.label')}
        className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1"
      >
        <span>© Bookly</span>
        <Link to={paths.privacy} className="inline-flex min-h-11 items-center hover:text-ink">
          {t('footer.privacy')}
        </Link>
        <Link to={paths.terms} className="inline-flex min-h-11 items-center hover:text-ink">
          {t('footer.terms')}
        </Link>
      </nav>
    </footer>
  )
}
