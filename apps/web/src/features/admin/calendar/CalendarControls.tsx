import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, type SelectOption } from '@/components/ui/SelectField'
import { shortDateOfKey, weekdayShortOfKey } from '@/lib/format'
import type { CalendarView } from './calendarModel'

interface DateNavigatorProps {
  date: string
  /** Full title, read by screen readers and shown from 640 px ("Martedì 24 novembre 2026"). */
  title: string
  /** Shorter title for phones ("Mar 24 nov", "23 – 29 nov"). */
  shortTitle: string
  view: CalendarView
  isToday: boolean
  onMove: (direction: -1 | 1) => void
  onToday: () => void
  onPick: (date: string) => void
}

/** Opens the native date picker: on desktop browsers a click on the field alone does not. */
function openPicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker()
  } catch {
    // Not supported or not allowed (e.g. inside a cross-origin frame): the field still works.
  }
}

/**
 * ‹ date › Oggi (DEC-041). The date is the heading and also the "Vai alla data" field: a
 * transparent date input covers it, so a tap opens the picker without a separate field.
 */
export function DateNavigator({
  date,
  title,
  shortTitle,
  view,
  isToday,
  onMove,
  onToday,
  onPick,
}: DateNavigatorProps) {
  const { t } = useTranslation('admin')
  return (
    <div className="flex items-center gap-1 xl:gap-2">
      <Button
        variant="ghost"
        className="shrink-0 px-2.5 sm:px-3"
        aria-label={t('calendar.previous')}
        onClick={() => onMove(-1)}
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </Button>
      <div className="group relative min-w-0 flex-1 rounded-control has-focus-visible:ring-3 has-focus-visible:ring-primary/25 xl:flex-none">
        <h2
          aria-live="polite"
          className="flex min-h-11 items-center justify-center gap-1 rounded-control border border-border bg-surface px-2 text-[15px] font-semibold transition-colors group-hover:border-ink/60 sm:gap-1.5 sm:px-3 sm:text-base xl:border-transparent xl:bg-transparent xl:text-lg xl:group-hover:border-transparent xl:group-hover:bg-subtle"
        >
          <span aria-hidden="true" className="min-w-0 truncate sm:hidden">
            {shortTitle}
          </span>
          <span className="sr-only sm:not-sr-only sm:min-w-0 sm:truncate">{title}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
        </h2>
        <input
          type="date"
          aria-label={t('calendar.goToDate')}
          value={date}
          onClick={openPicker}
          onChange={(event) => event.target.value && onPick(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </div>
      <Button
        variant="ghost"
        className="shrink-0 px-2.5 sm:px-3"
        aria-label={t('calendar.next')}
        onClick={() => onMove(1)}
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </Button>
      <Button
        variant="secondary"
        className="shrink-0 px-3 sm:px-3.5"
        onClick={onToday}
        disabled={isToday && view === 'day'}
      >
        {t('calendar.today')}
      </Button>
    </div>
  )
}

interface ViewSwitchProps {
  view: CalendarView
  onChange: (view: CalendarView) => void
}

/** Giorno / Settimana: full width on phones, compact beside the filters from 640 px. */
export function ViewSwitch({ view, onChange }: ViewSwitchProps) {
  const { t } = useTranslation('admin')
  return (
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
          onClick={() => onChange(value)}
          className="min-h-11 rounded-control px-3.5 text-sm font-semibold text-muted transition-colors not-aria-checked:hover:bg-surface/60 not-aria-checked:hover:text-ink aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm"
        >
          {t(`calendar.views.${value}`)}
        </button>
      ))}
    </div>
  )
}

export interface CalendarFilters {
  staffId: string | null
  includeCancelled: boolean
}

interface FiltersProps {
  filters: CalendarFilters
  /** Owner with more than one operator: the staff filter is offered. */
  staffOptions: SelectOption[] | null
  onChange: (filters: CalendarFilters) => void
}

/** Filters inline in the toolbar from 1280 px. */
export function InlineFilters({ filters, staffOptions, onChange }: FiltersProps) {
  const { t } = useTranslation('admin')
  return (
    <div className="flex items-center gap-2">
      {staffOptions && (
        <SelectField
          label={t('calendar.staffLabel')}
          className="[&>label]:sr-only"
          value={filters.staffId ?? ''}
          onChange={(event) => onChange({ ...filters, staffId: event.target.value || null })}
          options={staffOptions}
        />
      )}
      <CheckboxField
        label={t('calendar.showCancelled')}
        className="whitespace-nowrap"
        checked={filters.includeCancelled}
        onChange={(event) => onChange({ ...filters, includeCancelled: event.target.checked })}
      />
    </div>
  )
}

/**
 * Below 1280 px: a "Filtri" button with the number of active filters, which opens a sheet, and
 * the active filters as chips that remove themselves on tap (DEC-041).
 */
export function FiltersButton({ filters, staffOptions, onChange }: FiltersProps) {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const staffName = staffOptions?.find((o) => o.value === filters.staffId)?.label
  const chips: { key: string; label: string; remove: () => void }[] = []
  if (staffName) {
    chips.push({
      key: 'staff',
      label: staffName,
      remove: () => onChange({ ...filters, staffId: null }),
    })
  }
  if (filters.includeCancelled) {
    chips.push({
      key: 'cancelled',
      label: t('calendar.filters.cancelled'),
      remove: () => onChange({ ...filters, includeCancelled: false }),
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        {t('calendar.filters.open')}
        {chips.length > 0 && (
          <>
            <span
              aria-hidden="true"
              className="inline-flex size-5 items-center justify-center rounded-pill bg-primary text-xs font-bold text-primary-fg"
            >
              {chips.length}
            </span>
            <span className="sr-only">
              , {t('calendar.filters.active', { count: chips.length })}
            </span>
          </>
        )}
      </Button>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          aria-label={t('calendar.filters.remove', { name: chip.label })}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-primary-soft pr-3 pl-3.5 text-sm font-semibold text-primary-text transition-colors hover:bg-primary/15"
        >
          {chip.label}
          <X aria-hidden="true" className="size-4" />
        </button>
      ))}
      {open && (
        <FiltersDialog
          filters={filters}
          staffOptions={staffOptions}
          onApply={(next) => {
            onChange(next)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function FiltersDialog({
  filters,
  staffOptions,
  onApply,
  onClose,
}: {
  filters: CalendarFilters
  staffOptions: SelectOption[] | null
  onApply: (filters: CalendarFilters) => void
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  // A draft: nothing changes on the calendar until "Applica".
  const [draft, setDraft] = useState(filters)
  return (
    <Dialog
      open
      title={t('calendar.filters.title')}
      closeLabel={t('actions.close')}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => setDraft({ staffId: null, includeCancelled: false })}
          >
            {t('calendar.filters.reset')}
          </Button>
          <Button onClick={() => onApply(draft)}>{t('calendar.filters.apply')}</Button>
        </>
      }
    >
      {staffOptions && (
        <SelectField
          label={t('calendar.staffLabel')}
          value={draft.staffId ?? ''}
          onChange={(event) => setDraft({ ...draft, staffId: event.target.value || null })}
          options={staffOptions}
        />
      )}
      <CheckboxField
        label={t('calendar.showCancelled')}
        checked={draft.includeCancelled}
        onChange={(event) => setDraft({ ...draft, includeCancelled: event.target.checked })}
      />
    </Dialog>
  )
}

interface WeekStripProps {
  days: string[]
  selected: string
  today: string
  /** Appointments shown per day (after the filters). */
  countOf: (day: string) => number
  onSelect: (day: string) => void
}

/**
 * Phones, week view: the seven days in a row, a dot under the days with appointments; the list
 * below shows the chosen day instead of seven "Nessun appuntamento" blocks (DEC-041).
 */
export function WeekStrip({ days, selected, today, countOf, onSelect }: WeekStripProps) {
  const { t } = useTranslation('admin')
  return (
    <div role="group" aria-label={t('calendar.weekDays')} className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const count = countOf(day)
        const isSelected = day === selected
        const date = shortDateOfKey(day)
        return (
          <button
            key={day}
            type="button"
            aria-pressed={isSelected}
            aria-label={
              count > 0 ? t('calendar.dayCount', { date, count }) : t('calendar.dayEmpty', { date })
            }
            onClick={() => onSelect(day)}
            className={`flex min-h-15 flex-col items-center justify-center gap-0.5 rounded-control border transition-colors ${
              isSelected
                ? 'border-primary bg-primary text-primary-fg'
                : `bg-surface hover:bg-subtle ${day === today ? 'border-primary text-primary-text' : 'border-border text-ink'}`
            }`}
          >
            <span className="text-xs font-medium capitalize">{weekdayShortOfKey(day)}</span>
            <span className="text-base leading-none font-bold">{Number(day.slice(8))}</span>
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-pill ${count > 0 ? (isSelected ? 'bg-primary-fg' : 'bg-primary') : 'bg-transparent'}`}
            />
          </button>
        )
      })}
    </div>
  )
}
