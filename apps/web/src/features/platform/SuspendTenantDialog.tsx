import { CalendarCheck, CalendarClock, CircleAlert, LoaderCircle, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { RadioCardGroup } from '@/components/ui/RadioCardGroup'
import type { PlatformTenant } from '@/types/api'
import { useFutureAppointments, useSetTenantStatus } from './platformApi'
import { platformErrorMessage } from './platformErrors'

type Choice = 'cancel' | 'keep'

interface SuspendTenantDialogProps {
  tenant: PlatformTenant
  onClose: () => void
}

/**
 * Suspension with the choice of what to do with the future appointments (DEC-039). The
 * super-admin sees only how many there are; nothing is preselected, so cancelling (and emailing
 * the customers) is always a deliberate choice.
 */
export function SuspendTenantDialog({ tenant, onClose }: SuspendTenantDialogProps) {
  const { t } = useTranslation(['platform', 'common', 'admin'])
  const future = useFutureAppointments(tenant.id)
  const setStatus = useSetTenantStatus()
  const [choice, setChoice] = useState<Choice | null>(null)
  const [missingChoice, setMissingChoice] = useState(false)

  const count = future.data
  const hasFuture = count !== undefined && count > 0

  const confirmLabel = !hasFuture
    ? t('tenants.suspend')
    : choice === 'cancel'
      ? t('tenants.suspendDialog.confirmCancel', { count })
      : choice === 'keep'
        ? t('tenants.suspendDialog.keep')
        : t('tenants.suspend')

  const pick = (value: Choice) => {
    setChoice(value)
    setMissingChoice(false)
  }

  const submit = async () => {
    if (count === undefined) return
    if (hasFuture && choice === null) {
      setMissingChoice(true)
      return
    }

    const cancel = hasFuture && choice === 'cancel'
    try {
      const updated = await setStatus.mutateAsync({
        id: tenant.id,
        status: 'Suspended',
        cancelFutureAppointments: cancel,
      })
      // The server counts again in its transaction: the toast shows what really happened.
      const cancelled = updated.suspensionNotices?.cancelledAppointments ?? 0
      toast.success(
        cancel && cancelled > 0
          ? t('tenants.suspendedCancelled', { count: cancelled })
          : hasFuture && !cancel
            ? t('tenants.suspendedKept')
            : t('tenants.suspended'),
      )
      onClose()
    } catch (error) {
      toast.error(platformErrorMessage(t, error))
      void future.refetch()
    }
  }

  return (
    <Dialog
      open
      title={t('tenants.suspendTitle', { name: tenant.name })}
      closeLabel={t('admin:actions.close')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('admin:actions.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={setStatus.isPending}
            disabled={count === undefined}
            onClick={() => void submit()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-muted">{t('tenants.suspendText')}</p>

      {future.isPending && (
        <p
          role="status"
          className="flex items-center gap-2.5 rounded-control bg-subtle p-3.5 text-muted"
        >
          <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin" />
          {t('tenants.suspendDialog.counting')}
        </p>
      )}

      {future.isError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-control bg-danger-soft p-3.5 text-danger"
        >
          <p className="flex items-start gap-2.5">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            {t('tenants.suspendDialog.countError')}
          </p>
          <Button
            variant="secondary"
            className="self-start"
            loading={future.isFetching}
            onClick={() => void future.refetch()}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            {t('tenants.suspendDialog.retry')}
          </Button>
        </div>
      )}

      {count === 0 && (
        <p className="flex items-start gap-3 rounded-control bg-subtle p-3.5">
          <CalendarCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span>
            <strong className="font-semibold">{t('tenants.suspendDialog.none')}</strong>{' '}
            {t('tenants.suspendDialog.noneSuffix')}
          </span>
        </p>
      )}

      {hasFuture && (
        <>
          <p className="flex items-center gap-3 rounded-control bg-subtle p-3.5">
            <CalendarClock aria-hidden="true" className="size-5 shrink-0" />
            <span>
              <strong className="font-semibold">
                {t('tenants.suspendDialog.future', { count })}
              </strong>{' '}
              {t('tenants.suspendDialog.futureSuffix', { count })}
            </span>
          </p>
          <RadioCardGroup<Choice>
            legend={t('tenants.suspendDialog.legend')}
            value={choice}
            onChange={pick}
            error={missingChoice ? t('tenants.suspendDialog.chooseError') : undefined}
            options={[
              {
                value: 'cancel',
                label: t('tenants.suspendDialog.cancel', { count }),
                description: t('tenants.suspendDialog.cancelHint', { count }),
              },
              {
                value: 'keep',
                label: t('tenants.suspendDialog.keep'),
                description: t('tenants.suspendDialog.keepHint', { count }),
              },
            ]}
          />
        </>
      )}
    </Dialog>
  )
}
