import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { compactDate, compactDateTime } from '@/lib/format'
import type { CustomerStats } from '@/types/api'
import { StatusBadge } from '../calendar/StatusBadge'
import { useCustomerAppointments, type AppointmentsWhen, type CustomerRef } from './customersApi'

interface CustomerAppointmentsProps {
  customer: CustomerRef
  stats: CustomerStats
  when: AppointmentsWhen
  onWhenChange: (when: AppointmentsWhen) => void
}

/**
 * The "Appuntamenti" tab: a few numbers, then upcoming or past appointments ten at a time.
 * A regular customer can have hundreds: the list grows only on "Mostra altri 10".
 */
export function CustomerAppointments({
  customer,
  stats,
  when,
  onWhenChange,
}: CustomerAppointmentsProps) {
  const { t } = useTranslation(['admin', 'common'])
  const appointments = useCustomerAppointments(customer, when, true)
  const items = appointments.data?.pages.flatMap((page) => page.items) ?? []
  const total = appointments.data?.pages[0]?.total ?? 0

  const numbers = [
    { key: 'total', value: stats.total, tone: 'text-ink' },
    {
      key: 'completed',
      value: stats.completed,
      tone: stats.completed > 0 ? 'text-success' : 'text-ink',
    },
    { key: 'noShow', value: stats.noShow, tone: stats.noShow > 0 ? 'text-warning' : 'text-ink' },
    { key: 'cancelled', value: stats.cancelled, tone: 'text-ink' },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {numbers.map((n) => (
          <div key={n.key} className="rounded-control bg-subtle px-3 py-2">
            <dt className="text-sm text-muted">{t(`customers.stats.${n.key}`)}</dt>
            <dd className={`font-heading text-2xl font-semibold ${n.tone}`}>{n.value}</dd>
          </div>
        ))}
      </dl>
      <p className="flex flex-col gap-1 text-[15px] sm:flex-row sm:gap-3">
        <span>
          {t('customers.stats.lastVisit')}:{' '}
          <strong>
            {stats.lastVisit ? compactDate(stats.lastVisit) : t('customers.detail.noValue')}
          </strong>
        </span>
        <span>
          {t('customers.stats.next')}:{' '}
          <strong>
            {stats.nextAppointment
              ? compactDateTime(stats.nextAppointment)
              : t('customers.stats.none')}
          </strong>
        </span>
      </p>

      <SegmentedControl
        label={t('customers.when.label')}
        value={when}
        onChange={onWhenChange}
        className="self-stretch sm:self-start"
        fullWidth
        options={[
          { value: 'upcoming', label: t('customers.when.upcoming', { count: stats.upcoming }) },
          { value: 'past', label: t('customers.when.past', { count: stats.past }) },
        ]}
      />

      {appointments.isPending && (
        <div role="status" className="flex justify-center py-8 text-muted">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
          <span className="sr-only">{t('common:loading')}</span>
        </div>
      )}
      {appointments.isError && <p className="text-danger">{t('errors.load')}</p>}
      {appointments.isSuccess && items.length === 0 && (
        <p className="text-muted">
          {when === 'upcoming' ? t('customers.noUpcoming') : t('customers.noPast')}
        </p>
      )}

      {items.length > 0 && (
        <>
          <table className="hidden w-full border-collapse text-left text-[15px] sm:table">
            <thead>
              <tr className="border-b border-border text-sm text-muted">
                <th scope="col" className="px-2 py-2 font-semibold">
                  {t('customers.table.date')}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {t('customers.table.service')}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {t('customers.table.staff')}
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  {t('customers.table.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-b-0">
                  <td className="px-2 py-2 font-medium whitespace-nowrap">
                    {compactDateTime(a.start)}
                  </td>
                  <td className="px-2 py-2">{a.serviceName}</td>
                  <td className="px-2 py-2 text-muted">{a.staffName}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="flex flex-col border-t border-border sm:hidden">
            {items.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-border py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{compactDateTime(a.start)}</span>
                  <span className="truncate text-sm text-muted">
                    {a.serviceName} · {a.staffName}
                  </span>
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
            <p role="status" className="text-sm text-muted">
              {t('customers.shownOf', { shown: items.length, total })}
            </p>
            {appointments.hasNextPage && (
              <Button
                variant="secondary"
                loading={appointments.isFetchingNextPage}
                onClick={() => void appointments.fetchNextPage()}
              >
                {t('customers.showMoreAppointments')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
