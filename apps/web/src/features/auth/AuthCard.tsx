import type { ReactNode } from 'react'

/** Shared frame of the authentication pages (neutral platform brand). */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted">{subtitle}</p>}
      </div>
      {children}
    </main>
  )
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'danger'
  children: ReactNode
}) {
  const tones = {
    info: 'border-border bg-surface text-ink',
    success: 'border-success bg-success-soft text-success',
    danger: 'border-danger bg-danger-soft text-danger',
  }
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded-card border p-4 ${tones[tone]}`}
    >
      {children}
    </div>
  )
}
