import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { SelectField } from '@/components/ui/SelectField'
import { addDays, compactDate, dateKey, longDate, shortDateOfKey, todayIn } from '@/lib/format'
import type { AdminAppointment } from '@/types/api'
import { useAdminStaff } from '../adminApi'
import { AdminPageHeader, EmptyState, QueryState } from '../AdminUi'
import { useActiveMembership } from '../useAdminRole'
import { Agenda } from './Agenda'
import { AppointmentDialog } from './AppointmentDialog'
import { useCalendar } from './calendarApi'
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
        }))

  const title =
    view === 'day'
      ? longDate(`${date}T12:00:00Z`, 'UTC', true)
      : `${shortDateOfKey(from)} – ${shortDateOfKey(to)}`

  // A click on free space of the grid, but not in the past.
  const createAt = (column: GridColumn, minutes: number) => {
    if (column.date < today || (column.date === today && minutes < nowMinutes)) return
    setCreating({
      date: column.date,
      time: toTime(minutes),
      staffId: column.staffIds.length === 1 ? column.staffIds[0] : undefined,
    })
  }

  const staffOptions = [
    { value: '', label: t('calendar.allStaff') },
    ...(allStaff ?? []).map((s) => ({ value: s.id, label: s.displayName })),
  ]

  return (
    <section className="flex flex-col gap-5">
      <AdminPageHeader
        title={t('calendar.title')}
        action={
          <Button
            onClick={() =>
              setCreating({ date: date < today ? today : date, staffId: staffId ?? undefined })
            }
          >
            <Plus aria-hidden="true" className="size-5" />
            {t('calendar.new.open')}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => update({ [DATE_PARAM]: today })}
            disabled={date === today && view === 'day'}
          >
            {t('calendar.today')}
          </Button>
          <Button
            variant="ghost"
            className="px-3"
            aria-label={t('calendar.previous')}
            onClick={() => update({ [DATE_PARAM]: addDays(date, -step) })}
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Button>
          <Button
            variant="ghost"
            className="px-3"
            aria-label={t('calendar.next')}
            onClick={() => update({ [DATE_PARAM]: addDays(date, step) })}
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </Button>
          <h2 aria-live="polite" className="text-lg font-semibold first-letter:uppercase">
            {title}
          </h2>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div
            role="radiogroup"
            aria-label={t('calendar.viewLabel')}
            className="grid grid-cols-2 gap-1 rounded-card bg-subtle p-1"
          >
            {(['day', 'week'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => update({ [VIEW_PARAM]: value === 'week' ? 'settimana' : null })}
                className="min-h-11 rounded-control px-4 text-sm font-semibold text-muted aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm"
              >
                {t(`calendar.views.${value}`)}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t('calendar.goToDate')}
            <input
              type="date"
              value={date}
              onChange={(e) => KEY.test(e.target.value) && update({ [DATE_PARAM]: e.target.value })}
              className="min-h-11 rounded-control border border-border-strong bg-surface px-2 font-normal text-ink"
            />
          </label>
          {isOwner && (allStaff?.length ?? 0) > 1 && (
            <SelectField
              label={t('calendar.staffLabel')}
              value={staffId ?? ''}
              onChange={(e) => update({ [STAFF_PARAM]: e.target.value || null })}
              options={staffOptions}
            />
          )}
          <CheckboxField
            label={t('calendar.showCancelled')}
            checked={includeCancelled}
            onChange={(e) => update({ [CANCELLED_PARAM]: e.target.checked ? '1' : null })}
          />
        </div>
      </div>

      <QueryState isPending={isPending} error={error}>
        {data && staff.length === 0 && <EmptyState>{t('calendar.noStaff')}</EmptyState>}
        {data && staff.length > 0 && (
          <>
            <div className="md:hidden">
              <Agenda
                days={days}
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
                onCreateAt={createAt}
              />
            </div>
          </>
        )}
      </QueryState>

      {creating && (
        <NewAppointmentDialog
          // Keyed: each opening starts from its own date, time and staff member.
          key={`${creating.date}-${creating.time ?? ''}-${creating.staffId ?? ''}`}
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
        />
      )}
    </section>
  )
}
