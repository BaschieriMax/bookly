import { Navigate, Outlet, useSearchParams } from 'react-router'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { safeRedirect } from '@/features/auth/safeRedirect'
import { useMe } from '@/features/auth/useMe'

/** Login/registration pages are pointless for a signed-in user: continue to the requested page. */
export function RedirectIfAuthenticated() {
  const { data: me, isPending } = useMe()
  const [params] = useSearchParams()

  if (isPending) {
    return <PageSpinner />
  }

  return me ? <Navigate to={safeRedirect(params.get('redirect'))} replace /> : <Outlet />
}
