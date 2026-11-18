import { LoaderCircle } from 'lucide-react'

/** Centralised fallback shown while a lazy route chunk is loading. */
export function PageSpinner() {
  return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center text-muted">
      <LoaderCircle aria-hidden="true" className="size-8 animate-spin" />
      <span className="sr-only">Caricamento…</span>
    </div>
  )
}
