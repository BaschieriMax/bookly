import { NoAccess } from '@/components/ui/NoAccess'
import { useMe } from '@/features/auth/useMe'
import { homePathFor } from '@/features/auth/userAreas'
import { ShellLayout } from './ShellLayout'

/** Platform area: super-admins only (the API enforces it as well). */
export function PlatformLayout() {
  const { data: me } = useMe()
  return me?.platformRoles.includes('SuperAdmin') ? (
    <ShellLayout area="platform" />
  ) : (
    <NoAccess homePath={homePathFor(me)} />
  )
}
