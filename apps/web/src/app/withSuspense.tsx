import { Suspense, type ReactNode } from 'react'
import { PageSpinner } from '@/components/ui/PageSpinner'

/** Wraps a lazily loaded page with the shared loading fallback. */
export function withSuspense(page: ReactNode) {
  return <Suspense fallback={<PageSpinner />}>{page}</Suspense>
}
