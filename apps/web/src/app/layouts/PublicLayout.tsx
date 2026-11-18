import { Outlet } from 'react-router'

/** Layout for public pages (landing, tenant pages, legal). */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Outlet />
    </div>
  )
}
