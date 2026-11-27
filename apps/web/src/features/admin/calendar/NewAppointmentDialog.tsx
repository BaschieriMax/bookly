import { CircleAlert, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { formatDuration, formatPrice, todayIn } from '@/lib/format'
import { isApiError } from '@/services/apiClient'
import type { CreateBusinessAppointmentRequest, CustomerSearchResult } from '@/types/api'
import { useAdminServices, useAdminStaff } from '../adminApi'
import { QueryState } from '../AdminUi'
import { adminErrorMessage } from '../adminErrors'
import { customerSchema } from '../customers/customerSchema'
import { validationMessage } from '../formHelpers'
import { useActiveMembership } from '../useAdminRole'
import { useCalendar, useCreateAppointment } from './calendarApi'
import { minutesOf, nowMinutesIn } from './calendarModel'
import {
  CustomerPicker,
  type CustomerChoice,
  type NewCustomerErrors,
  type NewCustomerInput,
} from './CustomerPicker'
import { checkSlot, nextSlot, timeOptions, toTime } from './newAppointmentModel'

/**
 * Where the dialog was opened from: the button (date only), an empty spot of the grid, or
 * "Prenota di nuovo" on a past appointment (service and customer too, DEC-044).
 */
export interface NewAppointmentStart {
  date: string
  time?: string
  staffId?: string
  serviceId?: string
  customer?: CustomerSearchResult
}

interface NewAppointmentDialogProps {
  start: NewAppointmentStart
  timeZone: string
  onClose: () => void
}

const hasValidEmail = (email: string) => z.email().safeParse(email.trim()).success

/**
 * The business enters an appointment taken by phone or in person (DEC-037). Busy and
 * out-of-hours times are flagged from the day's calendar before saving; the API checks again
 * and the database refuses overlaps.
 */
export function NewAppointmentDialog({ start, timeZone, onClose }: NewAppointmentDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const staffLegendId = useId()
  const { isOwner } = useActiveMembership()
  const servicesQuery = useAdminServices()
  const staffQuery = useAdminStaff()
  const services = servicesQuery.data ?? []
  const allStaff = staffQuery.data ?? []
  const create = useCreateAppointment()

  const activeServices = services
    .filter((s) => s.isActive && s.staffIds.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  const [chosenServiceId, setServiceId] = useState<string | null>(start.serviceId ?? null)
  const service =
    activeServices.find((s) => s.id === chosenServiceId) ??
    activeServices.find((s) => !start.staffId || s.staffIds.includes(start.staffId)) ??
    activeServices[0]

  // Owners choose anyone offering the service; staff members only themselves.
  const eligibleStaff = allStaff.filter(
    (s) => s.isActive && (service?.staffIds.includes(s.id) ?? false) && (isOwner || s.isMe),
  )
  const [chosenStaffId, setStaffId] = useState(start.staffId ?? null)
  const staff = eligibleStaff.find((s) => s.id === chosenStaffId) ?? eligibleStaff[0]

  const [date, setDate] = useState(start.date)
  const [time, setTime] = useState(
    start.time ??
      (start.date === todayIn(timeZone) ? toTime(nextSlot(nowMinutesIn(timeZone))) : '09:00'),
  )
  const [note, setNote] = useState('')
  const [customer, setCustomer] = useState<CustomerChoice | null>(
    start.customer ? { kind: 'existing', customer: start.customer } : null,
  )
  const [notify, setNotify] = useState(true)
  const [outsideConfirmed, setOutsideConfirmed] = useState(false)
  const [serverSaysOutside, setServerSaysOutside] = useState(false)
  const [attempted, setAttempted] = useState(false)

  const { data: day } = useCalendar({
    from: date,
    to: date,
    staffId: null,
    includeCancelled: false,
  })
  const slot = (value: string) =>
    checkSlot({
      calendar: day,
      staffId: staff?.id ?? '',
      date,
      time: value,
      durationMinutes: service?.durationMinutes ?? 0,
      bufferMinutes: service?.bufferMinutes ?? 0,
    })
  const check = slot(time)
  const needsConfirmation = check.outsideHours || serverSaysOutside

  const customerCheck = customer?.kind === 'new' ? customerSchema.safeParse(customer.input) : null
  const customerErrors: NewCustomerErrors = {}
  if (attempted && customerCheck && !customerCheck.success) {
    for (const issue of customerCheck.error.issues) {
      const field = issue.path[0] as keyof NewCustomerInput
      customerErrors[field] ??= validationMessage(t, issue.message)
    }
  }
  const email =
    customer?.kind === 'existing'
      ? (customer.customer.email ?? '')
      : customer?.kind === 'new' && hasValidEmail(customer.input.email)
        ? customer.input.email.trim()
        : ''

  // Changing what the warning is about asks for a new confirmation.
  const resetConfirmation = () => {
    setOutsideConfirmed(false)
    setServerSaysOutside(false)
  }

  const save = async () => {
    setAttempted(true)
    if (
      !service ||
      !staff ||
      !customer ||
      check.clash ||
      (needsConfirmation && !outsideConfirmed) ||
      (customerCheck && !customerCheck.success)
    ) {
      return
    }

    const body: CreateBusinessAppointmentRequest = {
      serviceId: service.id,
      staffId: staff.id,
      date,
      time,
      customerAccountId:
        customer.kind === 'existing' && customer.customer.kind === 'Account'
          ? customer.customer.id
          : null,
      tenantCustomerId:
        customer.kind === 'existing' && customer.customer.kind === 'AddressBook'
          ? customer.customer.id
          : null,
      newCustomer:
        customer.kind === 'new'
          ? {
              firstName: customer.input.firstName.trim(),
              lastName: customer.input.lastName.trim(),
              phone: customer.input.phone.trim(),
              email: customer.input.email.trim() || null,
            }
          : null,
      note: note.trim() || null,
      notifyCustomer: notify && email !== '',
      allowOutsideHours: outsideConfirmed,
    }

    try {
      await create.mutateAsync(body)
      toast.success(t('calendar.new.done'))
      onClose()
    } catch (error) {
      // The calendar shown was out of date: show the warning and let the user confirm.
      if (isApiError(error) && error.code === 'admin.outside_working_hours') {
        setServerSaysOutside(true)
      }
      toast.error(adminErrorMessage(t, error))
    }
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        {t('actions.cancel')}
      </Button>
      <Button
        loading={create.isPending}
        disabled={!service || !staff || check.clash !== null}
        onClick={() => void save()}
      >
        {t('calendar.new.submit')}
      </Button>
    </>
  )

  return (
    <Dialog
      open
      size="wide"
      title={t('calendar.new.title')}
      closeLabel={t('actions.close')}
      onClose={onClose}
      footer={footer}
    >
      {/* Until services and staff arrive the list is only empty, not missing: no "add a service" hint. */}
      <QueryState
        isPending={servicesQuery.isPending || staffQuery.isPending}
        error={servicesQuery.error ?? staffQuery.error}
      >
        {activeServices.length === 0 ? (
          <p className="text-muted">{t('calendar.new.noServices')}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            <div className="flex min-w-0 flex-col gap-4">
              <SelectField
                label={t('calendar.new.service')}
                value={service?.id ?? ''}
                onChange={(e) => {
                  setServiceId(e.target.value)
                  resetConfirmation()
                }}
                options={activeServices.map((s) => ({
                  value: s.id,
                  label: [
                    s.name,
                    formatDuration(s.durationMinutes),
                    formatPrice(s.priceCents, s.priceIsFrom),
                  ]
                    .filter(Boolean)
                    .join(' · '),
                }))}
              />

              <fieldset className="flex flex-col gap-2" aria-labelledby={staffLegendId}>
                <legend id={staffLegendId} className="mb-2 text-sm font-semibold">
                  {t('calendar.new.staff')}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {eligibleStaff.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={s.id === staff?.id}
                      onClick={() => {
                        setStaffId(s.id)
                        resetConfirmation()
                      }}
                      className="min-h-11 rounded-pill border border-border-strong bg-surface px-4 font-semibold text-ink hover:bg-subtle aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-fg"
                    >
                      {s.displayName}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* One per row: the time labels ("10:15 · occupato") need the full width. */}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                <TextField
                  type="date"
                  label={t('calendar.new.date')}
                  value={date}
                  min={todayIn(timeZone)}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value)
                    resetConfirmation()
                  }}
                />
                <SelectField
                  label={t('calendar.new.time')}
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value)
                    resetConfirmation()
                  }}
                  options={timeOptions().map((value) => {
                    const option = slot(value)
                    return {
                      value,
                      label: option.clash
                        ? t('calendar.new.busyOption', { time: value })
                        : option.outsideHours
                          ? t('calendar.new.outsideOption', { time: value })
                          : value,
                    }
                  })}
                />
              </div>

              {service && staff && (
                <p className="-mt-2 text-sm text-muted">
                  {t('calendar.new.summary', {
                    service: service.name,
                    start: time,
                    end: toTime((minutesOf(time) + service.durationMinutes) % (24 * 60)),
                    staff: staff.displayName,
                  })}
                </p>
              )}

              {check.clash && staff && (
                <p
                  role="alert"
                  className="flex gap-2 rounded-control bg-danger-soft p-3 text-sm text-danger"
                >
                  <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {t('calendar.new.clash', {
                    staff: staff.displayName,
                    start: toTime(check.clash.start),
                    end: toTime(check.clash.end),
                  })}
                </p>
              )}

              {!check.clash && needsConfirmation && staff && (
                <div className="flex flex-col gap-1 rounded-control bg-warning-soft p-3 text-sm text-warning">
                  <p className="flex gap-2">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {t('calendar.new.outside', { staff: staff.displayName })}
                  </p>
                  <CheckboxField
                    label={t('calendar.new.outsideConfirm')}
                    checked={outsideConfirmed}
                    onChange={(e) => setOutsideConfirmed(e.target.checked)}
                    className="font-semibold text-ink"
                  />
                </div>
              )}

              <TextAreaField
                label={t('calendar.new.note')}
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <CustomerPicker value={customer} onChange={setCustomer} errors={customerErrors} />
              {attempted && !customer && (
                <p role="alert" className="-mt-2 text-sm text-danger">
                  {t('calendar.new.customerRequired')}
                </p>
              )}
              <CheckboxField
                label={t('calendar.new.notify')}
                description={customer && email === '' ? t('calendar.new.noEmail') : undefined}
                checked={notify && email !== ''}
                disabled={email === ''}
                onChange={(e) => setNotify(e.target.checked)}
              />
            </div>
          </div>
        )}
      </QueryState>
    </Dialog>
  )
}
