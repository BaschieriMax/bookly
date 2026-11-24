import { zodResolver } from '@hookform/resolvers/zod'
import { Download, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { TabList, TabPanel } from '@/components/ui/Tabs'
import { TextField } from '@/components/ui/TextField'
import { compactDateTime, fullDate } from '@/lib/format'
import type { CustomerDetail } from '@/types/api'
import { adminErrorMessage } from '../adminErrors'
import { Badge, QueryState } from '../AdminUi'
import { validationMessage } from '../formHelpers'
import { CustomerAppointments } from './CustomerAppointments'
import { customerSchema, type CustomerInput } from './customerSchema'
import {
  useCustomer,
  useDownloadCustomer,
  useEraseCustomer,
  useUpdateCustomer,
  type AppointmentsWhen,
  type CustomerRef,
} from './customersApi'

type Tab = 'data' | 'appointments'

interface CustomerDialogProps {
  customer: CustomerRef
  /** Shown as title while the details load. */
  name: string
  onClose: () => void
}

/**
 * A customer of the business, in two tabs with a fixed height: "Dati" (editable for the
 * address book, read-only for accounts) and "Appuntamenti". Address-book entries can also be
 * downloaded and erased (GDPR requests of people without an account, DEC-038).
 */
export function CustomerDialog({ customer, name, onClose }: CustomerDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const idBase = useId()
  const formId = useId()
  const [tab, setTab] = useState<Tab>('data')
  const [when, setWhen] = useState<AppointmentsWhen | null>(null)
  const [confirming, setConfirming] = useState(false)
  const detail = useCustomer(customer)
  const update = useUpdateCustomer(customer.id)
  const download = useDownloadCustomer()
  const erase = useEraseCustomer()
  const data = detail.data
  const isBook = customer.kind === 'AddressBook'
  const title = data ? `${data.firstName} ${data.lastName}` : name

  const save = async (values: CustomerInput) => {
    try {
      await update.mutateAsync({ ...values, email: values.email.trim() || null })
      toast.success(t('customers.detail.saved'))
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
    }
  }

  const confirmErase = async () => {
    try {
      const result = await erase.mutateAsync(customer.id)
      toast.success(
        result.cancelledAppointments > 0
          ? t('customers.erasedWithCancellations', { count: result.cancelledAppointments })
          : t('customers.erased'),
      )
      onClose()
    } catch (error) {
      toast.error(adminErrorMessage(t, error))
      setConfirming(false)
    }
  }

  const footer = !data ? null : isBook ? (
    <>
      <div className="col-span-2 grid grid-cols-2 gap-2 sm:mr-auto sm:flex">
        <Button
          variant="secondary"
          loading={download.isPending}
          onClick={() =>
            download.mutate(customer.id, {
              onSuccess: () => toast.success(t('customers.detail.downloaded')),
              onError: (error) => toast.error(adminErrorMessage(t, error)),
            })
          }
        >
          <Download aria-hidden="true" className="hidden size-4 sm:block" />
          {t('customers.detail.download')}
        </Button>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" className="hidden size-4 sm:block" />
          {t('customers.detail.erase')}
        </Button>
      </div>
      {tab === 'data' && (
        <Button type="submit" form={formId} className="col-span-2" loading={update.isPending}>
          {t('actions.saveChanges')}
        </Button>
      )}
    </>
  ) : (
    <Button variant="secondary" onClick={onClose}>
      {t('actions.close')}
    </Button>
  )

  return (
    <>
      <Dialog
        // Hidden, not closed, while the erase is confirmed: one modal at a time.
        open={!confirming}
        title={title}
        titleAddon={
          <Badge tone={isBook ? 'neutral' : 'primary'}>
            {t(`customers.kinds.${customer.kind}`)}
          </Badge>
        }
        closeLabel={t('actions.close')}
        size="wide"
        fixedHeight
        onClose={onClose}
        toolbar={
          <TabList
            idBase={idBase}
            label={t('customers.detail.tabsLabel')}
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'data', label: t('customers.detail.data') },
              {
                value: 'appointments',
                label: data
                  ? t('customers.detail.appointments', { count: data.stats.total })
                  : t('customers.detail.appointmentsLoading'),
              },
            ]}
          />
        }
        footer={footer}
      >
        <QueryState isPending={detail.isPending} error={detail.error}>
          {data && (
            <>
              {/* Kept mounted while hidden: unsaved changes survive a look at the appointments. */}
              <TabPanel idBase={idBase} value="data" hidden={tab !== 'data'}>
                {isBook ? (
                  <CustomerForm key={data.id} formId={formId} customer={data} onSubmit={save} />
                ) : (
                  <AccountData customer={data} />
                )}
              </TabPanel>
              {tab === 'appointments' && (
                <TabPanel idBase={idBase} value="appointments">
                  <CustomerAppointments
                    customer={customer}
                    stats={data.stats}
                    when={when ?? (data.stats.upcoming > 0 ? 'upcoming' : 'past')}
                    onWhenChange={setWhen}
                  />
                </TabPanel>
              )}
            </>
          )}
        </QueryState>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        title={t('customers.eraseConfirm.title', { name: title })}
        confirmLabel={t('customers.eraseConfirm.confirm')}
        cancelLabel={t('customers.eraseConfirm.keep')}
        danger
        loading={erase.isPending}
        onConfirm={() => void confirmErase()}
        onClose={() => setConfirming(false)}
      >
        <div className="flex flex-col gap-3">
          <p>{t('customers.eraseConfirm.text')}</p>
          {data?.stats.nextAppointment && (
            <p className="rounded-control bg-warning-soft p-3 text-sm text-warning">
              {t('customers.eraseConfirm.future', {
                when: compactDateTime(data.stats.nextAppointment),
              })}
            </p>
          )}
          <p className="text-sm">{t('customers.eraseConfirm.warning')}</p>
        </div>
      </ConfirmDialog>
    </>
  )
}

interface CustomerFormProps {
  formId: string
  customer: CustomerDetail
  onSubmit: (values: CustomerInput) => Promise<void>
}

function CustomerForm({ formId, customer, onSubmit }: CustomerFormProps) {
  const { t } = useTranslation(['admin', 'common'])
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
    },
  })
  const message = (key: string | undefined) => validationMessage(t, key)

  return (
    <form
      id={formId}
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-xl flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('calendar.new.firstName')}
          autoComplete="off"
          error={message(errors.firstName?.message)}
          {...register('firstName')}
        />
        <TextField
          label={t('calendar.new.lastName')}
          autoComplete="off"
          error={message(errors.lastName?.message)}
          {...register('lastName')}
        />
      </div>
      <TextField
        type="tel"
        label={t('calendar.new.phone')}
        autoComplete="off"
        error={message(errors.phone?.message)}
        {...register('phone')}
      />
      <TextField
        type="email"
        label={t('calendar.new.email')}
        autoComplete="off"
        error={message(errors.email?.message)}
        {...register('email')}
      />
      {customer.createdAt && (
        <p className="text-sm text-muted">
          {t('customers.detail.since', { date: fullDate(customer.createdAt) })}
        </p>
      )}
    </form>
  )
}

function AccountData({ customer }: { customer: CustomerDetail }) {
  const { t } = useTranslation('admin')
  const none = t('customers.detail.noValue')
  return (
    <div className="flex max-w-xl flex-col gap-4 text-[15px]">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">{t('customers.columns.phone')}</dt>
          <dd>{customer.phone || none}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{t('customers.columns.email')}</dt>
          <dd className="break-all">{customer.email || none}</dd>
        </div>
      </dl>
      <p className="rounded-control bg-subtle p-3 text-sm text-muted">
        {t('customers.detail.accountNote')}
      </p>
    </div>
  )
}
