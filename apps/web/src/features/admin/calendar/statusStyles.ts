import type admin from '@/i18n/it/admin.json'

export type AppointmentStatus = keyof (typeof admin)['calendar']['status']

/** Badge colors per status (semantic tokens only, DEC-018). */
export const statusTone: Record<string, string> = {
  Confirmed: 'bg-primary-soft text-primary-text',
  Completed: 'bg-success-soft text-success',
  NoShow: 'bg-warning-soft text-warning',
  CancelledByCustomer: 'bg-subtle text-muted',
  CancelledByBusiness: 'bg-danger-soft text-danger',
}

/** Event block colors in the time grid. */
export const statusBlock: Record<string, string> = {
  Confirmed: 'border-primary bg-primary-soft text-ink',
  Completed: 'border-success bg-success-soft text-ink',
  NoShow: 'border-warning bg-warning-soft text-ink',
  CancelledByCustomer: 'border-border-strong bg-subtle text-muted line-through',
  CancelledByBusiness: 'border-border-strong bg-subtle text-muted line-through',
}
