import { CalendarCheck, ChevronRight, Clock, MapPin, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { formatDuration, formatPrice } from '@/lib/format'
import { useServices } from './tenantApi'
import { useCurrentTenant } from './tenantContext'
import { TenantHeader } from './TenantHeader'

const eyebrow = 'text-[13px] font-semibold tracking-[0.14em] text-primary-text'

/** Public page of a business: /b/:slug (prototype "Pagina attività"). */
export default function TenantPage() {
  const tenant = useCurrentTenant()
  const { t } = useTranslation('booking')
  const { data: services, isPending } = useServices(tenant.slug)
  const bookingPath = `/b/${tenant.slug}/prenota`

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <TenantHeader tenant={tenant} />

      <section className="flex flex-col gap-3 px-5 pt-8 pb-7 sm:px-8">
        <span className={eyebrow}>{t('bookOnline')}</span>
        <h1 className="font-tenant-heading text-5xl leading-none sm:text-6xl">{t('heroTitle')}</h1>
        <p className="max-w-xl text-lg text-muted">{t('heroLead')}</p>
        <ul className="mt-3 flex flex-col gap-2.5 text-[15px]">
          {tenant.address && (
            <li className="flex items-center gap-2.5">
              <MapPin aria-hidden="true" className="size-[18px] text-primary-text" />
              {tenant.address}
            </li>
          )}
          {tenant.phone && (
            <li className="flex items-center gap-2.5">
              <Phone aria-hidden="true" className="size-[18px] text-primary-text" />
              <a
                href={`tel:${tenant.phone.replaceAll(' ', '')}`}
                className="underline-offset-2 hover:underline"
              >
                {tenant.phone}
              </a>
            </li>
          )}
          <li className="flex items-center gap-2.5 text-muted">
            <Clock aria-hidden="true" className="size-[18px] text-primary-text" />
            {t('howStep3', { hours: tenant.cancellationWindowHours })}
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="services-title"
        className="flex flex-col gap-2 bg-subtle px-5 pt-8 pb-6 sm:px-8"
      >
        <span className={eyebrow}>{t('priceList')}</span>
        <h2 id="services-title" className="mb-2 font-tenant-heading text-4xl leading-tight">
          {t('chooseService')}
        </h2>
        {isPending && <PageSpinner />}
        <ul className="flex flex-col">
          {services?.map((service) => (
            <li key={service.id}>
              <Link
                to={`${bookingPath}?servizio=${service.id}`}
                className="flex min-h-11 items-center gap-3 border-b border-border py-4"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-lg font-semibold">{service.name}</span>
                  {service.description && (
                    <span className="text-[15px] text-muted">{service.description}</span>
                  )}
                  <span className="text-[13px] text-muted">
                    {formatDuration(service.durationMinutes)}
                  </span>
                </span>
                <span className="text-xl font-semibold whitespace-nowrap text-primary-text">
                  {formatPrice(service.priceCents, service.priceIsFrom) ?? t('priceOnRequest')}
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto flex flex-col gap-1.5 border-t border-border px-5 pt-5 pb-28 text-[13px] text-muted sm:px-8">
        <span>{t('poweredBy')}</span>
        <Link to="/privacy" className="underline">
          {t('privacy')}
        </Link>
      </footer>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg px-5 pt-3 pb-6">
        <Link
          to={bookingPath}
          className="mx-auto flex min-h-13 max-w-3xl items-center justify-center gap-2 rounded-control bg-primary font-semibold text-primary-fg hover:bg-primary-hover"
        >
          <CalendarCheck aria-hidden="true" className="size-5" />
          {t('bookNow')}
        </Link>
      </div>
    </div>
  )
}
