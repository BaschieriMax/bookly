import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { SelectField } from '@/components/ui/SelectField'
import { useAdminStaff, useWorkingHours } from './adminApi'
import { AdminPageHeader, EmptyState, QueryState } from './AdminUi'
import { TimeOffPanel } from './TimeOffPanel'
import { useActiveMembership } from './useAdminRole'
import { WeeklyHoursEditor } from './WeeklyHoursEditor'

function StaffSchedule({ staffId }: { staffId: string }) {
  const { data: hours, isPending, error } = useWorkingHours(staffId)
  return (
    <QueryState isPending={isPending} error={error}>
      {/* Keyed by staff: switching operator resets the local editing state. */}
      {hours && <WeeklyHoursEditor key={staffId} staffId={staffId} initial={hours} />}
    </QueryState>
  )
}

/** Weekly hours and time off. The owner manages everyone; staff only themselves. */
export default function SchedulePage() {
  const { t } = useTranslation('admin')
  const { isOwner } = useActiveMembership()
  const { data: staff, isPending, error } = useAdminStaff()
  const [selected, setSelected] = useState<string | null>(null)

  const editable = (staff ?? []).filter((s) => isOwner || s.isMe)
  const staffId = editable.some((s) => s.id === selected) ? selected : (editable[0]?.id ?? null)

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader title={t('schedule.title')} lead={t('schedule.lead')} />
      <QueryState isPending={isPending} error={error}>
        {editable.length === 0 && <EmptyState>{t('schedule.noStaff')}</EmptyState>}
        {editable.length > 1 && (
          <SelectField
            label={t('schedule.staffLabel')}
            className="max-w-sm"
            value={staffId ?? ''}
            onChange={(event) => setSelected(event.target.value)}
            options={editable.map((s) => ({ value: s.id, label: s.displayName }))}
          />
        )}
        {staffId ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
            <StaffSchedule staffId={staffId} />
            <TimeOffPanel key={staffId} staffId={staffId} />
          </div>
        ) : (
          isPending && <PageSpinner />
        )}
      </QueryState>
    </section>
  )
}
