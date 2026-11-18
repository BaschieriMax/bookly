import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { PlaceholderPage } from '@/components/ui/PlaceholderPage'
import i18n from '@/i18n'
import type nav from '@/i18n/it/nav.json'
import { RedirectIfAuthenticated } from './guards/RedirectIfAuthenticated'
import { RequireAuth } from './guards/RequireAuth'
import { PublicLayout } from './layouts/PublicLayout'
import { NotFoundPage } from './NotFoundPage'
import { paths } from './paths'
import { RouteError } from './RouteError'
import { withSuspense } from './withSuspense'

const HomePage = lazy(() => import('@/features/home/HomePage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
// Admin and platform shells are only downloaded by signed-in staff, never by customers.
const AdminLayout = lazy(() =>
  import('./layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const PlatformLayout = lazy(() =>
  import('./layouts/PlatformLayout').then((m) => ({ default: m.PlatformLayout })),
)

type NavKey = keyof typeof nav
const placeholder = (key: NavKey) => <PlaceholderPage title={i18n.t(key, { ns: 'nav' })} />

export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      {
        element: <RedirectIfAuthenticated />,
        children: [{ path: paths.login, element: withSuspense(<LoginPage />) }],
      },
    ],
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: withSuspense(<AdminLayout />),
        children: [
          { path: paths.admin.calendar, element: placeholder('calendar') },
          { path: paths.admin.services, element: placeholder('services') },
          { path: paths.admin.staff, element: placeholder('staff') },
          { path: paths.admin.schedule, element: placeholder('schedule') },
          { path: paths.admin.brand, element: placeholder('brand') },
          { path: paths.admin.settings, element: placeholder('settings') },
        ],
      },
      {
        element: withSuspense(<PlatformLayout />),
        children: [
          { path: paths.platform.tenants, element: placeholder('tenants') },
          { path: paths.platform.navigation, element: placeholder('navigation') },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]
