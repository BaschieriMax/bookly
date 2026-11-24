import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'

interface LegalSection {
  title: string
  paragraphs: string[]
}

/** Date of the current legal texts: update it whenever legal.json changes. */
const UPDATED_AT = '18 novembre 2026'

/** Privacy policy or terms of service, rendered from the "legal" translations (drafts). */
export function LegalPage({ document }: { document: 'privacy' | 'terms' }) {
  const { t } = useTranslation('legal')
  const sections = t(`${document}.sections`, { returnObjects: true }) as LegalSection[]

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link
        to={paths.home}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-sm font-semibold text-muted hover:bg-subtle"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Turnora
      </Link>
      <article className="mt-4 flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {t(`${document}.title`)}
          </h1>
          <p className="text-sm text-muted">{t('updatedAt', { date: UPDATED_AT })}</p>
          <p
            role="note"
            className="rounded-card border border-warning bg-warning-soft p-3 text-sm text-warning"
          >
            {t('draftNotice')}
          </p>
          <p className="text-lg text-muted">{t(`${document}.intro`)}</p>
        </header>
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="font-heading text-xl font-semibold">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </main>
  )
}
