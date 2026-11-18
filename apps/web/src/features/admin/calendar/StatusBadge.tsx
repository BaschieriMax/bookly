import { useTranslation } from 'react-i18next'
import { statusTone, type AppointmentStatus } from './statusStyles'

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('admin')
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${statusTone[status] ?? statusTone.Confirmed}`}
    >
      {t(`calendar.status.${status as AppointmentStatus}`)}
    </span>
  )
}
