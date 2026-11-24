import { ShieldAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { isApiError } from '@/services/apiClient'

interface AdminPageHeaderProps {
  title: string
  lead?: string
  action?: ReactNode
}

export function AdminPageHeader({ title, lead, action }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        {lead && <p className="text-muted">{lead}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

interface PageActionProps {
  icon: LucideIcon
  label: string
  onClick: () => void
}

/**
 * Main action of a page ("Nuovo appuntamento", "Nuovo servizio"), DEC-041: a button beside the
 * title from 640 px; on phones a round floating button at the bottom right, within reach of the
 * thumb, so the title row stays short. One element in both layouts: announced once, full name.
 * The shell leaves room for it at the bottom of the page.
 */
export function PageAction({ icon: Icon, label, onClick }: PageActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-30 inline-flex size-14 items-center justify-center gap-2 rounded-pill bg-primary font-semibold text-primary-fg shadow-lg transition-[background-color,transform] duration-150 hover:bg-primary-hover active:scale-[0.97] sm:static sm:z-auto sm:size-auto sm:min-h-11 sm:rounded-control sm:px-4 sm:shadow-none"
    >
      <Icon aria-hidden="true" className="size-6 sm:size-5" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  )
}

interface QueryStateProps {
  isPending: boolean
  error: unknown
  children: ReactNode
}

/** Spinner while loading, an inline message on 403 or other errors, otherwise the content. */
export function QueryState({ isPending, error, children }: QueryStateProps) {
  const { t } = useTranslation(['admin', 'common'])
  const queryClient = useQueryClient()

  if (error) {
    const forbidden = isApiError(error, 403)
    const offline = isApiError(error, 0)
    const Icon = forbidden ? ShieldAlert : TriangleAlert
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-6 text-muted"
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <p className="flex-1">
          {forbidden
            ? t('errors.forbidden')
            : offline
              ? t('common:errors.network')
              : t('errors.load')}
        </p>
        {!forbidden && (
          <Button
            variant="secondary"
            onClick={() =>
              void queryClient.refetchQueries({ predicate: (q) => q.state.status === 'error' })
            }
          >
            {t('common:retry')}
          </Button>
        )}
      </div>
    )
  }

  if (isPending) return <PageSpinner />
  return <>{children}</>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-border-strong bg-surface p-6 text-center text-muted">
      {children}
    </p>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'primary' | 'warning'
}) {
  const tones = {
    neutral: 'bg-subtle text-muted',
    primary: 'bg-primary-soft text-primary-text',
    warning: 'bg-warning-soft text-warning',
  }
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

/** Card section with a title, used by settings, schedule and brand pages. */
export function Panel({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-5 sm:p-6 ${className}`}
    >
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}
