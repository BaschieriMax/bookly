import { generatePath } from 'react-router'

/** Every client route in one place: used by the router and to validate server navigation items. */
export const paths = {
  home: '/',
  login: '/login',
  register: '/registrati',
  forgotPassword: '/password-dimenticata',
  resetPassword: '/reimposta-password',
  confirmEmail: '/conferma-email',
  invitation: '/invito',
  privacy: '/privacy',
  terms: '/termini',
  tenant: '/b/:slug',
  booking: '/b/:slug/prenota',
  myAppointments: '/account/appuntamenti',
  myProfile: '/account/profilo',
  admin: {
    calendar: '/admin',
    customers: '/admin/clienti',
    services: '/admin/servizi',
    staff: '/admin/staff',
    schedule: '/admin/orari',
    brand: '/admin/brand',
    settings: '/admin/impostazioni',
  },
  platform: {
    tenants: '/platform/tenant',
    navigation: '/platform/navigazione',
  },
} as const

/** Routes the server may reference from the sidebar (DEC-019). */
export const knownRoutes: ReadonlySet<string> = new Set<string>([
  ...Object.values(paths.admin),
  ...Object.values(paths.platform),
])

/** Public page of a tenant ("/b/barberia-demo"). */
export function tenantPath(slug: string): string {
  return generatePath(paths.tenant, { slug })
}

/** Booking flow of a tenant ("/b/barberia-demo/prenota"). */
export function bookingPath(slug: string): string {
  return generatePath(paths.booking, { slug })
}

const withRedirect = (path: string, redirect?: string) =>
  redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path

/** Login page; `redirect` (not encoded) is where to go back after signing in. */
export function loginPath(redirect?: string): string {
  return withRedirect(paths.login, redirect)
}

/** Sign-up page; `redirect` (not encoded) is where to go back after confirming the email. */
export function registerPath(redirect?: string): string {
  return withRedirect(paths.register, redirect)
}
