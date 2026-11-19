import { Outlet } from 'react-router'
import { LegalFooter } from '@/components/layout/LegalFooter'
import { PublicHeader } from './PublicHeader'

/** Layout for public pages (landing, auth, legal). */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <Outlet />
      <LegalFooter />
    </div>
  )
}
