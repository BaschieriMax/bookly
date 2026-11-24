import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from './paths'

export function NotFoundPage() {
  const { t } = useTranslation(['common', 'nav'])
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-3xl font-semibold">{t('notFound.title')}</h1>
      <p className="text-muted">{t('notFound.text')}</p>
      <Link
        to={paths.home}
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
      >
        {t('nav:backHome')}
      </Link>
    </main>
  )
}
