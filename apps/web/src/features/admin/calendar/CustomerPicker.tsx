import { Check, Search, UserPlus } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TextField } from '@/components/ui/TextField'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { CustomerSearchResult } from '@/types/api'
import { CUSTOMER_QUERY_MIN, useCustomerSearch } from './calendarApi'
import { splitSearch } from './newAppointmentModel'

export interface NewCustomerInput {
  firstName: string
  lastName: string
  phone: string
  email: string
}

export type CustomerChoice =
  { kind: 'existing'; customer: CustomerSearchResult } | { kind: 'new'; input: NewCustomerInput }

export type NewCustomerErrors = Partial<Record<keyof NewCustomerInput, string>>

interface CustomerPickerProps {
  value: CustomerChoice | null
  onChange: (value: CustomerChoice | null) => void
  /** Messages for the "new customer" fields, shown after a save attempt. */
  errors: NewCustomerErrors
}

const EMPTY: NewCustomerInput = { firstName: '', lastName: '', phone: '', email: '' }

/**
 * Who the appointment is for (DEC-037): search the address book and the customers who booked
 * online, or type a new one. Results are a plain list of toggle buttons inside the dialog, not a
 * popup combobox: simpler, and it works the same with a screen reader and on a phone.
 */
export function CustomerPicker({ value, onChange, errors }: CustomerPickerProps) {
  const { t } = useTranslation('admin')
  const headingId = useId()
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query)
  const search = useCustomerSearch(debounced)
  const isNew = value?.kind === 'new'
  const results = debounced.trim().length >= CUSTOMER_QUERY_MIN ? (search.data ?? []) : []
  const selectedId = value?.kind === 'existing' ? value.customer.id : null

  const startNew = () => onChange({ kind: 'new', input: { ...EMPTY, ...splitSearch(query) } })
  const setField = (field: keyof NewCustomerInput, text: string) =>
    value?.kind === 'new' && onChange({ kind: 'new', input: { ...value.input, [field]: text } })

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-sm font-semibold">
        {t('calendar.new.customer')}
      </h3>

      {!isNew && (
        <>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('calendar.new.searchLabel')}
              placeholder={t('calendar.new.searchPlaceholder')}
              autoComplete="off"
              className="min-h-11 w-full min-w-0 rounded-control border border-border-strong bg-surface pr-3 pl-9 text-ink"
            />
          </div>

          {query.trim().length < CUSTOMER_QUERY_MIN ? (
            <p className="text-sm text-muted">{t('calendar.new.searchHint')}</p>
          ) : (
            <div aria-live="polite" aria-busy={search.isFetching}>
              {results.length > 0 ? (
                <ul aria-label={t('calendar.new.results')} className="flex flex-col gap-2">
                  {results.map((customer) => {
                    const selected = customer.id === selectedId
                    const contact = [customer.phone, customer.email].filter(Boolean).join(' · ')
                    return (
                      <li key={`${customer.kind}-${customer.id}`}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onChange(selected ? null : { kind: 'existing', customer })}
                          className="flex min-h-14 w-full items-center gap-3 rounded-control border border-border px-3 py-2 text-left hover:bg-subtle aria-pressed:border-primary aria-pressed:bg-primary-soft"
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-semibold">
                              {customer.firstName} {customer.lastName}
                            </span>
                            {contact && (
                              <span className="truncate text-sm text-muted">{contact}</span>
                            )}
                          </span>
                          <span
                            className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold ${
                              customer.kind === 'Account'
                                ? 'bg-primary-soft text-primary-text'
                                : 'bg-subtle text-muted'
                            }`}
                          >
                            {t(
                              customer.kind === 'Account'
                                ? 'calendar.new.kindAccount'
                                : 'calendar.new.kindAddressBook',
                            )}
                          </span>
                          {selected && (
                            <Check
                              aria-hidden="true"
                              className="size-5 shrink-0 text-primary-text"
                            />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                !search.isFetching && (
                  <p className="text-sm text-muted">
                    {t('calendar.new.noResults', { query: query.trim() })}
                  </p>
                )
              )}
            </div>
          )}

          <button
            type="button"
            onClick={startNew}
            className="-ml-3 flex min-h-11 items-center gap-2 self-start rounded-control px-3 font-semibold text-primary-text hover:bg-subtle"
          >
            <UserPlus aria-hidden="true" className="size-4" />
            {t('calendar.new.newCustomer')}
          </button>
        </>
      )}

      {value?.kind === 'new' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t('calendar.new.firstName')}
              value={value.input.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              error={errors.firstName}
              autoComplete="off"
              maxLength={100}
            />
            <TextField
              label={t('calendar.new.lastName')}
              value={value.input.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              error={errors.lastName}
              autoComplete="off"
              maxLength={100}
            />
          </div>
          <TextField
            type="tel"
            label={t('calendar.new.phone')}
            value={value.input.phone}
            onChange={(e) => setField('phone', e.target.value)}
            error={errors.phone}
            autoComplete="off"
            maxLength={30}
          />
          <TextField
            type="email"
            label={t('calendar.new.email')}
            hint={t('calendar.new.emailHint')}
            value={value.input.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
            autoComplete="off"
            maxLength={256}
          />
          <p className="text-sm text-muted">{t('calendar.new.addressBookNote')}</p>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="-ml-3 flex min-h-11 items-center gap-2 self-start rounded-control px-3 font-semibold text-primary-text hover:bg-subtle"
          >
            <Search aria-hidden="true" className="size-4" />
            {t('calendar.new.searchInstead')}
          </button>
        </>
      )}
    </section>
  )
}
