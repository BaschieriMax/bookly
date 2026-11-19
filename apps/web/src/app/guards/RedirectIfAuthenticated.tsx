import { Navigate, Outlet, useSearchParams } from 'react-router'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { useMe } from '@/features/auth/useMe'
import { landingPath } from '@/features/auth/userAreas'

/** Login/registration pages are pointless for a signed-in user: continue to the requested page or their area. */
export function RedirectIfAuthenticated() {
  const { data: me, isPending } = useMe()
  const [params] = useSearchParams()

  if (isPending) {
    return <PageSpinner />
  }

  return me ? <Navigate to={landingPath(me, params.get('redirect'))} replace /> : <Outlet />
}
