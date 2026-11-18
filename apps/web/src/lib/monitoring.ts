/**
 * Optional error tracking with Sentry (overview §20, DEC-031). The SDK is loaded only when a DSN
 * is baked into the build (VITE_SENTRY_DSN), in its own chunk. Nothing personal leaves the
 * browser: no user, no cookies or headers, and URLs lose their query string (it can carry email
 * confirmation, password reset or invitation tokens).
 */
import type * as SentryNamespace from '@sentry/react'
import type { Breadcrumb, ErrorEvent } from '@sentry/react'

type SentryModule = typeof SentryNamespace

let sentry: SentryModule | null = null

export function stripQuery(url: string | undefined): string | undefined {
  if (!url) return url
  const index = url.search(/[?#]/)
  return index < 0 ? url : url.slice(0, index)
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user
  if (event.request) {
    event.request.url = stripQuery(event.request.url)
    delete event.request.query_string
    delete event.request.cookies
    delete event.request.headers
    delete event.request.data
  }
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb)
  return event
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = breadcrumb.data ? { ...breadcrumb.data } : undefined
  if (data) {
    for (const key of ['url', 'from', 'to'] as const) {
      const value: unknown = data[key]
      if (typeof value === 'string') data[key] = stripQuery(value)
    }
  }
  return { ...breadcrumb, data }
}

export async function initMonitoring(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  sentry = await import('@sentry/react')
  sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  })
}

/** Reports an unexpected error; a no-op when monitoring is off. */
export function reportError(error: unknown): void {
  sentry?.captureException(error)
}
