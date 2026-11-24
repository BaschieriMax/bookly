import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { reportError } from '@/lib/monitoring'
import { paths } from './paths'

/** Error element used by every layout route. */
export function RouteError() {
  const { t } = useTranslation(['common', 'nav'])
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (isNotFound) return
    if (import.meta.env.DEV) console.error(error)
    reportError(error)
  }, [error, isNotFound])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-3xl font-semibold">
        {isNotFound ? t('notFound.title') : t('routeError.title')}
      </h1>
      <p className="text-muted">{isNotFound ? t('notFound.text') : t('routeError.text')}</p>
      <Link
        to={paths.home}
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
      >
        {t('nav:backHome')}
      </Link>
    </main>
  )
}
