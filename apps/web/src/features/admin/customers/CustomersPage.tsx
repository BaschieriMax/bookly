import { ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { compactDate, compactDateTime } from '@/lib/format'
import type { CustomerListItem } from '@/types/api'
import { AdminPageHeader, Badge, EmptyState, QueryState } from '../AdminUi'
import { CustomerDialog } from './CustomerDialog'
import { useCustomerList, type CustomerKind, type CustomerKindFilter } from './customersApi'

const FILTERS: readonly CustomerKindFilter[] = ['all', 'AddressBook', 'Account']

/**
 * "Clienti" (owners only, DEC-038): the address book and the accounts that booked here, in one
 * list sorted by last name. Cards on phones and tablets, a table from 1024 px; a row opens the customer.
 */
export default function CustomersPage() {
  const { t } = useTranslation(['admin', 'common'])
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<CustomerKindFilter>('all')
  const [selected, setSelected] = useState<CustomerListItem | null>(null)
  const query = useDebouncedValue(search)
  const list = useCustomerList(query, kind)
  const items = list.data?.pages.flatMap((page) => page.items) ?? []
  const total = list.data?.pages[0]?.total ?? 0
  const filtered = query.trim() !== '' || kind !== 'all'

  return (
    <section className="flex flex-col gap-5">
      <AdminPageHeader title={t('customers.title')} lead={t('customers.lead')} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="customer-search" className="text-sm font-semibold">
            {t('customers.searchLabel')}
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted"
            />
            <input
              id="customer-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('customers.searchPlaceholder')}
              autoComplete="off"
              className="min-h-11 w-full rounded-control border border-border-strong bg-surface pr-3 pl-10 text-ink"
            />
          </div>
        </div>
        <SegmentedControl
          label={t('customers.filterLabel')}
          value={kind}
          onChange={setKind}
          fullWidth
          className="sm:self-start lg:self-auto"
          options={FILTERS.map((value) => ({ value, label: t(`customers.filters.${value}`) }))}
        />
      </div>

      <QueryState isPending={list.isPending} error={list.error}>
        {items.length === 0 ? (
          <EmptyState>{filtered ? t('customers.noResults') : t('customers.empty')}</EmptyState>
        ) : (
          <>
            <p role="status" className="text-sm text-muted">
              {t('customers.count', { count: total })}
            </p>
            <CustomerTable items={items} onOpen={setSelected} />
            <CustomerCards items={items} onOpen={setSelected} />
            {list.hasNextPage && (
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
                <p className="text-sm text-muted">
                  {t('customers.shownOf', { shown: items.length, total })}
                </p>
                <Button
                  variant="secondary"
                  loading={list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                >
                  {t('customers.showMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </QueryState>

      <p className="text-sm text-muted">{t('customers.footnote')}</p>

      {selected && (
        <CustomerDialog
          customer={{ kind: selected.kind as CustomerKind, id: selected.id }}
          name={`${selected.firstName} ${selected.lastName}`}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}

interface CustomerListProps {
  items: CustomerListItem[]
  onOpen: (customer: CustomerListItem) => void
}

function KindBadge({ kind }: { kind: string }) {
  const { t } = useTranslation('admin')
  return (
    <Badge tone={kind === 'Account' ? 'primary' : 'neutral'}>
      {t(`customers.kinds.${kind as CustomerKind}`)}
    </Badge>
  )
}

/** From 1024 px. The name is the button (keyboard, screen readers); the row is a bigger target. */
function CustomerTable({ items, onOpen }: CustomerListProps) {
  const { t } = useTranslation('admin')
  const none = t('customers.detail.noValue')
  return (
    <div className="hidden overflow-x-auto rounded-card border border-border bg-surface lg:block">
      <table className="w-full border-collapse text-left text-[15px]">
        <thead>
          <tr className="border-b border-border bg-subtle text-sm text-muted">
            {(['name', 'phone', 'email', 'appointments', 'lastVisit', 'next'] as const).map(
              (column) => (
                <th
                  key={column}
                  scope="col"
                  className={`px-3 py-3 font-semibold xl:px-4 ${column === 'appointments' ? 'text-right' : ''} ${column === 'phone' || column === 'email' ? 'hidden xl:table-cell' : ''}`}
                >
                  {t(`customers.columns.${column}`)}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr
              key={`${c.kind}-${c.id}`}
              onClick={() => onOpen(c)}
              className="cursor-pointer border-b border-border last:border-b-0 hover:bg-subtle"
            >
              <td className="px-3 py-2 xl:px-4">
                <span className="flex flex-wrap items-center gap-x-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpen(c)
                    }}
                    className="min-h-11 text-left font-semibold text-ink underline-offset-4 hover:underline"
                  >
                    {c.firstName} {c.lastName}
                  </button>
                  <KindBadge kind={c.kind} />
                </span>
                {/* Below 1280 px the phone column is folded under the name. */}
                {c.phone && (
                  <span className="block pb-1 text-sm text-muted xl:hidden">{c.phone}</span>
                )}
              </td>
              <td className="hidden px-4 py-2 whitespace-nowrap xl:table-cell">
                {c.phone || none}
              </td>
              <td className="hidden max-w-64 truncate px-4 py-2 xl:table-cell">
                {c.email || none}
              </td>
              <td className="px-3 py-2 text-right tabular-nums xl:px-4">{c.appointments}</td>
              <td className="px-3 py-2 whitespace-nowrap xl:px-4">
                {c.lastVisit ? compactDate(c.lastVisit) : none}
              </td>
              <td
                className={`px-3 py-2 whitespace-nowrap xl:px-4 ${c.nextAppointment ? 'font-semibold text-primary-text' : 'text-muted'}`}
              >
                {c.nextAppointment ? compactDateTime(c.nextAppointment) : none}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Phones and tablets: one card per customer, the whole card is the button. */
function CustomerCards({ items, onOpen }: CustomerListProps) {
  const { t } = useTranslation('admin')
  return (
    <ul className="flex flex-col gap-2 lg:hidden">
      {items.map((c) => (
        <li key={`${c.kind}-${c.id}`}>
          <button
            type="button"
            onClick={() => onOpen(c)}
            className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left hover:bg-subtle"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {c.firstName} {c.lastName}
                </span>
                <KindBadge kind={c.kind} />
              </span>
              {c.phone && <span className="text-sm text-muted">{c.phone}</span>}
              <span className="text-sm text-muted">
                {t('customers.appointmentsCount', { count: c.appointments })}
                {c.nextAppointment && (
                  <>
                    {' · '}
                    <span className="font-semibold text-primary-text">
                      {t('customers.nextShort', { when: compactDateTime(c.nextAppointment) })}
                    </span>
                  </>
                )}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
          </button>
        </li>
      ))}
    </ul>
  )
}
