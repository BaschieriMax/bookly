import { Navigate, Outlet, useLocation } from 'react-router'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { useMe } from '@/features/auth/useMe'

/** UX guard only: the API authorizes every request on its own (overview §11). */
export function RequireAuth() {
  const { data: me, isPending } = useMe()
  const location = useLocation()

  if (isPending) {
    return <PageSpinner />
  }

  if (!me) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return <Outlet />
}
