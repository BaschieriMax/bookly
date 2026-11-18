import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

/** Error element used by every layout route. */
export function RouteError() {
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  if (import.meta.env.DEV && !isNotFound) {
    console.error(error)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-3xl font-semibold">
        {isNotFound ? 'Pagina non trovata' : 'Qualcosa è andato storto'}
      </h1>
      <p className="text-muted">
        {isNotFound
          ? 'Il link potrebbe essere errato o la pagina non esiste più.'
          : 'Riprova tra poco. Se il problema continua, contatta il supporto.'}
      </p>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-semibold text-primary-fg hover:bg-primary-hover"
      >
        Torna alla home
      </Link>
    </main>
  )
}
