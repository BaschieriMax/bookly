import { CalendarCheck } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-control bg-primary text-primary-fg"
        >
          <CalendarCheck className="size-5" />
        </span>
        <span className="font-heading text-2xl font-bold tracking-tight">bookly</span>
      </div>
      <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
        Prenotazioni online per attività locali
      </h1>
      <p className="max-w-xl text-lg text-muted">
        Ogni attività ha la sua pagina con il proprio brand. I clienti prenotano in pochi tocchi, i
        titolari gestiscono servizi, staff e calendario.
      </p>
    </main>
  )
}
