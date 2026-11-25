import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import {
  addDays,
  capitalize,
  compactDate,
  compactDateOfKey,
  dateKey,
  longDate,
  shortDateOfKey,
  todayIn,
  weekRangeLabel,
} from '@/lib/format'
import type { AdminAppointment } from '@/types/api'
import { useAdminStaff } from '../adminApi'
import { AdminPageHeader, EmptyState, PageAction, QueryState } from '../AdminUi'
import { useActiveMembership } from '../useAdminRole'
import { Agenda } from './Agenda'
import { AppointmentDialog } from './AppointmentDialog'
import type { MovePreview } from './moveModel'
import { useCalendar } from './calendarApi'
import {
  DateNavigator,
  FiltersButton,
  InlineFilters,
  ViewSwitch,
  WeekStrip,
  type CalendarFilters,
} from './CalendarControls'
import {
  dateOf,
  daysBetween,
  nowMinutesIn,
  rangeFor,
  visibleRange,
  type CalendarView,
} from './calendarModel'
import { NewAppointmentDialog, type NewAppointmentStart } from './NewAppointmentDialog'
import { toTime } from './newAppointmentModel'
import { TimeGrid, type GridColumn } from './TimeGrid'

const DATE_PARAM = 'data'
const VIEW_PARAM = 'vista'
const STAFF_PARAM = 'operatore'
const CANCELLED_PARAM = 'annullati'
const KEY = /^\d{4}-\d{2}-\d{2}$/

/** Calendar state lives in the URL, so a view can be bookmarked or shared with a colleague. */
function useCalendarParams() {
  const [params, setParams] = useSearchParams()
  const rawDate = params.get(DATE_PARAM) ?? ''
  const date = KEY.test(rawDate) ? rawDate : dateKey(new Date())
  const view: CalendarView = params.get(VIEW_PARAM) === 'settimana' ? 'week' : 'day'
  const staffId = params.get(STAFF_PARAM)
  const includeCancelled = params.get(CANCELLED_PARAM) === '1'

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )

  return { date, view, staffId, includeCancelled, update }
}

export default function CalendarPage() {
  const { t } = useTranslation('admin')
  const { isOwner } = useActiveMembership()
  const { date, view, staffId, includeCancelled, update } = useCalendarParams()
  const { from, to } = rangeFor(view, date)
  const { data, isPending, error } = useCalendar({ from, to, staffId, includeCancelled })
  const { data: allStaff } = useAdminStaff()
  const [selected, setSelected] = useState<AdminAppointment | null>(null)
  const [creating, setCreating] = useState<NewAppointmentStart | null>(null)
  const [preview, setPreview] = useState<MovePreview | null>(null)

  const timeZone = data?.timeZone ?? 'Europe/Rome'
  const today = todayIn(timeZone)
  const step = view === 'day' ? 1 : 7
  const days = daysBetween(from, to)
  const staff = data?.staff ?? []
  const staffName = (id: string) => staff.find((s) => s.id === id)?.displayName ?? ''
  const appointments = data?.appointments ?? []
  const timeOff = data?.timeOff ?? []
  const nowMinutes = nowMinutesIn(timeZone)

  const columns: GridColumn[] =
    view === 'day'
      ? staff.map((s) => ({
          key: s.id,
          label: s.displayName,
          date,
          staffIds: [s.id],
          appointments: appointments.filter((a) => a.staffId === s.id),
          timeOff: timeOff.filter((off) => off.staffId === s.id),
          isToday: date === today,
          // Staff columns are all the same day: none is highlighted as "today".
          highlight: false,
        }))
      : days.map((day) => ({
          key: day,
          label: compactDate(day),
          date: day,
          staffIds: staff.map((s) => s.id),
          appointments: appointments.filter((a) => dateOf(a.start) === day),
          // With several staff, a single absence does not close the day: show it only for one.
          timeOff: staff.length === 1 ? timeOff : [],
          isToday: day === today,
          highlight: day === today,
        }))

  const title = capitalize(
    view === 'day'
      ? longDate(`${date}T12:00:00Z`, 'UTC', true)
      : `${shortDateOfKey(from)} – ${shortDateOfKey(to)}`,
  )
  const shortTitle = view === 'day' ? capitalize(compactDateOfKey(date)) : weekRangeLabel(from, to)

  // New appointments from the grid: free space, but not in the past.
  const canCreateAt = (column: GridColumn, minutes: number) =>
    column.date > today || (column.date === today && minutes >= nowMinutes)
  const createAt = (column: GridColumn, minutes: number) => {
    if (!canCreateAt(column, minutes)) return
    setCreating({
      date: column.date,
      time: toTime(minutes),
      staffId: column.staffIds.length === 1 ? column.staffIds[0] : undefined,
    })
  }

  const staffOptions =
    isOwner && (allStaff?.length ?? 0) > 1
      ? [
          { value: '', label: t('calendar.allStaff') },
          ...(allStaff ?? []).map((s) => ({ value: s.id, label: s.displayName })),
        ]
      : null
  const filters: CalendarFilters = { staffId, includeCancelled }
  const setFilters = (next: CalendarFilters) =>
    update({ [STAFF_PARAM]: next.staffId, [CANCELLED_PARAM]: next.includeCancelled ? '1' : null })
  const openNew = () =>
    setCreating({ date: date < today ? today : date, staffId: staffId ?? undefined })
  // "Prenota di nuovo" (DEC-044): same customer, service and staff member, from today.
  const rebook = (appointment: AdminAppointment) => {
    const { customer } = appointment
    setSelected(null)
    if (!customer.id) return
    setCreating({
      date: today,
      staffId: appointment.staffId,
      serviceId: appointment.serviceId,
      customer: {
        kind: customer.hasAccount ? 'Account' : 'AddressBook',
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
      },
    })
  }

  return (
    // From 1280 px the page makes room for the details panel (28rem, DEC-044): the grid stays in
    // view next to it, with the preview of a move.
    <section
      className={`flex flex-col gap-4 transition-[padding] duration-200 ${selected ? 'xl:pr-[28rem]' : ''}`}
    >
      <AdminPageHeader
        title={t('calendar.title')}
        action={<PageAction icon={Plus} label={t('calendar.new.open')} onClick={openNew} />}
      />

      {/* One row from 1280 px; on phones date, view and filters stack (DEC-041). */}
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
        <DateNavigator
          date={date}
          title={title}
          shortTitle={shortTitle}
          view={view}
          isToday={date === today}
          onMove={(direction) => update({ [DATE_PARAM]: addDays(date, direction * step) })}
          onToday={() => update({ [DATE_PARAM]: today })}
          onPick={(picked) => KEY.test(picked) && update({ [DATE_PARAM]: picked })}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:gap-2">
          <ViewSwitch
            view={view}
            onChange={(next) => update({ [VIEW_PARAM]: next === 'week' ? 'settimana' : null })}
          />
          <div className="hidden xl:block">
            <InlineFilters filters={filters} staffOptions={staffOptions} onChange={setFilters} />
          </div>
          <div className="xl:hidden">
            <FiltersButton filters={filters} staffOptions={staffOptions} onChange={setFilters} />
          </div>
        </div>
      </div>

      <QueryState isPending={isPending} error={error}>
        {data && staff.length === 0 && <EmptyState>{t('calendar.noStaff')}</EmptyState>}
        {data && staff.length > 0 && (
          <>
            <div className="flex flex-col gap-4 md:hidden">
              {view === 'week' && (
                <WeekStrip
                  days={days}
                  selected={date}
                  today={today}
                  countOf={(day) => appointments.filter((a) => dateOf(a.start) === day).length}
                  onSelect={(day) => update({ [DATE_PARAM]: day })}
                />
              )}
              <Agenda
                // Phones show one day at a time; the week strip picks it.
                days={view === 'week' ? [date] : days}
                appointments={appointments}
                timeOff={timeOff}
                staffName={staffName}
                showStaff={staff.length > 1}
                onSelect={setSelected}
              />
            </div>
            <div className="hidden md:block">
              <TimeGrid
                columns={columns}
                hours={data.workingHours}
                range={visibleRange(data.workingHours, appointments)}
                nowMinutes={nowMinutes}
                staffName={staffName}
                onSelect={setSelected}
                canCreateAt={canCreateAt}
                onCreateAt={createAt}
                selectedId={selected?.id}
                preview={preview}
              />
            </div>
          </>
        )}
      </QueryState>

      {creating && (
        <NewAppointmentDialog
          // Keyed: each opening starts from its own date, time and staff member.
          key={`${creating.date}-${creating.time ?? ''}-${creating.staffId ?? ''}-${creating.customer?.id ?? ''}`}
          start={creating}
          timeZone={timeZone}
          onClose={() => setCreating(null)}
        />
      )}

      {selected && data && (
        <AppointmentDialog
          // Keyed: reopening another appointment resets the move/cancel form.
          key={selected.id}
          appointment={selected}
          staff={staff}
          timeZone={timeZone}
          canChooseStaff={isOwner}
          onClose={() => setSelected(null)}
          onPreview={setPreview}
          onRebook={rebook}
        />
      )}
    </section>
  )
}
