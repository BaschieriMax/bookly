import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { paths } from '@/app/paths'
import { NoAccess } from '@/components/ui/NoAccess'
import { useActiveMembership } from './useAdminRole'

/**
 * Management pages the API reserves to owners (services, staff, brand, settings). Staff members
 * reach them only by typing the URL: show a clear message instead of forms that would fail.
 */
export default function OwnerOnly() {
  const { t } = useTranslation('admin')
  const { isOwner } = useActiveMembership()
  return isOwner ? (
    <Outlet />
  ) : (
    <NoAccess embedded homePath={paths.admin.calendar} message={t('errors.forbidden')} />
  )
}
