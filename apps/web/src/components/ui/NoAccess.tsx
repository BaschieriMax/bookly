import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NoAccess() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlert aria-hidden="true" className="size-10 text-muted" />
      <h1 className="font-heading text-2xl font-semibold">{t('errors.forbidden')}</h1>
      <Link to="/" className="font-semibold text-primary">
        Torna alla home
      </Link>
    </main>
  )
}
