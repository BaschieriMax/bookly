import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

interface NoAccessProps {
  /** Where the user can go instead: their own area when known, otherwise the landing page. */
  homePath?: string
  /** Inside the admin/platform shell (no own <main>, no full-screen height). */
  embedded?: boolean
  /** More specific explanation than the generic "no permission". */
  message?: string
}

export function NoAccess({ homePath = '/', embedded = false, message }: NoAccessProps) {
  const { t } = useTranslation(['common', 'nav'])
  const Root = embedded ? 'section' : 'main'
  return (
    <Root
      className={`mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-6 text-center ${
        embedded ? 'py-16' : 'min-h-screen'
      }`}
    >
      <ShieldAlert aria-hidden="true" className="size-10 text-muted" />
      <h1 className="font-heading text-2xl font-semibold">{message ?? t('errors.forbidden')}</h1>
      <Link to={homePath} className="inline-flex min-h-11 items-center font-semibold text-primary">
        {homePath === '/' ? t('nav:backHome') : t('nav:goToYourArea')}
      </Link>
    </Root>
  )
}
