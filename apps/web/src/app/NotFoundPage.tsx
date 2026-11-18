import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-3xl font-semibold">Pagina non trovata</h1>
      <p className="text-muted">Il link potrebbe essere errato o la pagina non esiste più.</p>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-semibold text-primary-fg hover:bg-primary-hover"
      >
        Torna alla home
      </Link>
    </main>
  )
}
