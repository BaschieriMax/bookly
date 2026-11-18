/** Every client route in one place: used by the router and to validate server navigation items. */
export const paths = {
  home: '/',
  login: '/login',
  register: '/registrati',
  forgotPassword: '/password-dimenticata',
  admin: {
    calendar: '/admin',
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
