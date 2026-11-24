import { Navigate, Outlet, useLocation } from 'react-router'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { useMe } from '@/features/auth/useMe'
import { loginPath } from '@/app/paths'

/** UX guard only: the API authorizes every request on its own (overview §11). */
export function RequireAuth() {
  const { data: me, isPending } = useMe()
  const location = useLocation()

  if (isPending) {
    return <PageSpinner />
  }

  if (!me) {
    return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />
  }

  return <Outlet />
}
