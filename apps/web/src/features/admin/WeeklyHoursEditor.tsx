import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { SaveBar } from '@/components/ui/SaveBar'
import type { WorkingInterval } from '@/types/api'
import { useSaveWorkingHours } from './adminApi'
import { adminErrorMessage } from './adminErrors'
import { Panel } from './AdminUi'
import { invalidDays, newKey, toEditable, WEEK_DAYS, type EditableInterval } from './scheduleModel'
import { fieldClass } from '@/components/ui/fieldStyles'

interface WeeklyHoursEditorProps {
  staffId: string
  initial: WorkingInterval[]
}

/** Order-independent fingerprint of a week, to compare it with the saved one. */
function weekSignature(intervals: readonly EditableInterval[]): string {
  return intervals
    .map((i) => `${i.dayOfWeek} ${i.start}-${i.end}`)
    .sort()
    .join('|')
}

/** Weekly working intervals of one staff member, saved as a whole week (PUT). */
export function WeeklyHoursEditor({ staffId, initial }: WeeklyHoursEditorProps) {
  const { t } = useTranslation(['admin', 'common'])
  const save = useSaveWorkingHours(staffId)
  const [intervals, setIntervals] = useState<EditableInterval[]>(() => toEditable(initial))
  // Last saved week: the save bar appears only when the edited week differs from it.
  const [saved, setSaved] = useState<EditableInterval[]>(() => toEditable(initial))
  const invalid = invalidDays(intervals)
  const dirty = weekSignature(intervals) !== weekSignature(saved)

  const update = (key: string, patch: Partial<EditableInterval>) =>
    setIntervals((current) => current.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const add = (dayOfWeek: number) =>
    setIntervals((current) => {
      const last = current.filter((i) => i.dayOfWeek === dayOfWeek).at(-1)
      const start = last ? last.end : '09:00'
      const end = last ? (last.end < '18:00' ? '19:00' : '23:59') : '13:00'
      return [...current, { key: newKey(), dayOfWeek, start, end }]
    })

  const remove = (key: string) => setIntervals((current) => current.filter((i) => i.key !== key))

  const onSave = async () => {
    try {
      await save.mutateAsync(
        intervals.map(({ dayOfWeek, start, end }) => ({ dayOfWeek, start, end })),
      )
      setSaved(intervals)
      toast.success(t('schedule.hoursSaved'))
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  }

  return (
    <Panel title={t('schedule.weekTitle')}>
      <ul className="flex flex-col divide-y divide-border">
        {WEEK_DAYS.map((day) => {
          const dayName = t(`schedule.days.${day}`)
          const dayIntervals = intervals.filter((i) => i.dayOfWeek === day)
          const dayInvalid = invalid.has(day)
          return (
            <li key={day} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
              <h3 className="pt-2.5 font-semibold sm:w-32 sm:shrink-0">{dayName}</h3>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {dayIntervals.length === 0 && (
                  <p className="pt-2.5 text-muted">{t('schedule.closed')}</p>
                )}
                {dayIntervals.map((interval) => (
                  <div key={interval.key} className="flex max-w-md items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${dayName} ${t('schedule.from')}`}
                      aria-invalid={dayInvalid || undefined}
                      value={interval.start}
                      onChange={(e) => update(interval.key, { start: e.target.value })}
                      className={`min-h-11 w-full min-w-0 px-2 ${fieldClass(dayInvalid)}`}
                    />
                    <span aria-hidden="true" className="text-muted">
                      –
                    </span>
                    <input
                      type="time"
                      aria-label={`${dayName} ${t('schedule.to')}`}
                      aria-invalid={dayInvalid || undefined}
                      value={interval.end}
                      onChange={(e) => update(interval.key, { end: e.target.value })}
                      className={`min-h-11 w-full min-w-0 px-2 ${fieldClass(dayInvalid)}`}
                    />
                    <Button
                      variant="ghostDanger"
                      className="shrink-0 px-3"
                      onClick={() => remove(interval.key)}
                      aria-label={t('schedule.removeInterval', {
                        day: dayName,
                        start: interval.start,
                        end: interval.end,
                      })}
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  className="self-start px-2 text-sm"
                  onClick={() => add(day)}
                  aria-label={`${t('schedule.addInterval')} ${dayName}`}
                >
                  <Plus aria-hidden="true" className="size-4" />
                  {t('schedule.addInterval')}
                </Button>
                {dayInvalid && (
                  <p role="alert" className="text-sm text-danger">
                    {t('schedule.invalidDay')}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <SaveBar
        visible={dirty || save.isPending}
        saveLabel={t('schedule.saveHours')}
        saving={save.isPending}
        saveDisabled={invalid.size > 0}
        onSave={() => void onSave()}
        onDiscard={() => setIntervals(saved)}
      />
    </Panel>
  )
}
