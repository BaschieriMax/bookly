import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { RedirectIfAuthenticated } from './guards/RedirectIfAuthenticated'
import { RequireAuth } from './guards/RequireAuth'
import { PublicLayout } from './layouts/PublicLayout'
import { NotFoundPage } from './NotFoundPage'
import { paths } from './paths'
import { RouteError } from './RouteError'
import { withSuspense } from './withSuspense'

const HomePage = lazy(() => import('@/features/home/HomePage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const ConfirmEmailPage = lazy(() => import('@/features/auth/ConfirmEmailPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const AcceptInvitationPage = lazy(() => import('@/features/auth/AcceptInvitationPage'))
// Public tenant pages: their own chunk, with the tenant fonts.
const TenantLayout = lazy(() => import('@/features/tenant/TenantLayout'))
const TenantPage = lazy(() => import('@/features/tenant/TenantPage'))
const BookingPage = lazy(() => import('@/features/booking/BookingPage'))
const AccountLayout = lazy(() => import('@/features/account/AccountLayout'))
const MyAppointmentsPage = lazy(() => import('@/features/account/MyAppointmentsPage'))
const ProfilePage = lazy(() => import('@/features/account/ProfilePage'))
const PrivacyPage = lazy(() => import('@/features/legal/PrivacyPage'))
const TermsPage = lazy(() => import('@/features/legal/TermsPage'))
const CalendarPage = lazy(() => import('@/features/admin/calendar/CalendarPage'))
const TenantsPage = lazy(() => import('@/features/platform/TenantsPage'))
const NavigationAdminPage = lazy(() => import('@/features/platform/NavigationAdminPage'))
const ServicesPage = lazy(() => import('@/features/admin/ServicesPage'))
const StaffPage = lazy(() => import('@/features/admin/StaffPage'))
const SchedulePage = lazy(() => import('@/features/admin/SchedulePage'))
const BrandPage = lazy(() => import('@/features/admin/BrandPage'))
const SettingsPage = lazy(() => import('@/features/admin/SettingsPage'))
// Admin and platform shells are only downloaded by signed-in staff, never by customers.
const AdminLayout = lazy(() =>
  import('./layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const PlatformLayout = lazy(() =>
  import('./layouts/PlatformLayout').then((m) => ({ default: m.PlatformLayout })),
)

export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: paths.login, element: withSuspense(<LoginPage />) },
          { path: paths.register, element: withSuspense(<RegisterPage />) },
          { path: paths.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
        ],
      },
      { path: paths.confirmEmail, element: withSuspense(<ConfirmEmailPage />) },
      { path: paths.resetPassword, element: withSuspense(<ResetPasswordPage />) },
      { path: paths.invitation, element: withSuspense(<AcceptInvitationPage />) },
      { path: paths.privacy, element: withSuspense(<PrivacyPage />) },
      { path: paths.terms, element: withSuspense(<TermsPage />) },
    ],
  },
  {
    path: paths.tenant,
    element: withSuspense(<TenantLayout />),
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(<TenantPage />) },
      { path: 'prenota', element: withSuspense(<BookingPage />) },
    ],
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: withSuspense(<AccountLayout />),
        children: [
          { path: paths.myAppointments, element: withSuspense(<MyAppointmentsPage />) },
          { path: paths.myProfile, element: withSuspense(<ProfilePage />) },
        ],
      },
      {
        element: withSuspense(<AdminLayout />),
        children: [
          { path: paths.admin.calendar, element: withSuspense(<CalendarPage />) },
          { path: paths.admin.services, element: withSuspense(<ServicesPage />) },
          { path: paths.admin.staff, element: withSuspense(<StaffPage />) },
          { path: paths.admin.schedule, element: withSuspense(<SchedulePage />) },
          { path: paths.admin.brand, element: withSuspense(<BrandPage />) },
          { path: paths.admin.settings, element: withSuspense(<SettingsPage />) },
        ],
      },
      {
        element: withSuspense(<PlatformLayout />),
        children: [
          { path: paths.platform.tenants, element: withSuspense(<TenantsPage />) },
          { path: paths.platform.navigation, element: withSuspense(<NavigationAdminPage />) },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]
