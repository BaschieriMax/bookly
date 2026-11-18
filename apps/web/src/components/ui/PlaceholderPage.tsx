import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Temporary page for sections planned in later steps. */
export function PlaceholderPage({ title }: { title: string }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-6 text-muted">
        <Construction aria-hidden="true" className="size-5" />
        <p>
          <strong className="font-semibold text-ink">{t('comingSoon')}.</strong>{' '}
          {t('comingSoonDescription')}
        </p>
      </div>
    </section>
  )
}
