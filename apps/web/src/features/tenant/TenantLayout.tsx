import '@/styles/fonts-tenant.css'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useParams } from 'react-router'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { isApiError } from '@/services/apiClient'
import { useTenant } from './tenantApi'
import { TenantContext } from './tenantContext'
import { tenantThemeStyle } from './tenantTheme'

/** Public pages of a tenant, re-skinned with its brand (DEC-016). */
export default function TenantLayout() {
  const { slug = '' } = useParams()
  const { t } = useTranslation(['booking', 'common'])
  const { data: tenant, isPending, error } = useTenant(slug)

  if (isPending) {
    return <PageSpinner />
  }

  if (!tenant) {
    const notFound = isApiError(error, 404)
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-heading text-2xl font-semibold">
          {notFound ? t('errors.notFound') : t('common:errors.generic')}
        </h1>
        {notFound && <p className="text-muted">{t('errors.notFoundText')}</p>}
        <Link to="/" className="font-semibold text-primary-text">
          Bookly
        </Link>
      </main>
    )
  }

  return (
    <TenantContext value={tenant}>
      <div style={tenantThemeStyle(tenant.brand)} className="min-h-screen bg-bg text-ink">
        <Outlet />
      </div>
    </TenantContext>
  )
}
