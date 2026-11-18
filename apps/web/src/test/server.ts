import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type {
  AdminService,
  AdminStaff,
  MeResponse,
  MyAppointment,
  NavigationItem,
  PublicService,
  PublicTenant,
  TenantBrandSettings,
  TenantSettings,
  TimeOff,
  WorkingInterval,
} from '@/types/api'

export const TENANT_ID = '01a1eeca-0775-76cc-bee6-c94c4056036d'

export const ownerMe: MeResponse = {
  id: '01a1eeca-0a56-71d0-b67d-909e412d0496',
  email: 'titolare@bookly.local',
  firstName: 'Titolare',
  lastName: 'Demo',
  emailConfirmed: true,
  platformRoles: [],
  memberships: [
    {
      tenantId: TENANT_ID,
      tenantSlug: 'barberia-demo',
      tenantName: 'Barberia Demo',
      role: 'Owner',
    },
  ],
}

/** Mirrors NavigationSeed (apps/api/.../NavigationConfiguration.cs) for the Owner role. */
export const ownerNavigation: NavigationItem[] = [
  {
    key: 'admin.calendar',
    labelKey: 'nav.calendar',
    icon: 'calendar-days',
    route: '/admin',
    parentKey: null,
  },
  {
    key: 'admin.services',
    labelKey: 'nav.services',
    icon: 'scissors',
    route: '/admin/servizi',
    parentKey: null,
  },
  {
    key: 'admin.staff',
    labelKey: 'nav.staff',
    icon: 'users',
    route: '/admin/staff',
    parentKey: null,
  },
  {
    key: 'admin.schedule',
    labelKey: 'nav.schedule',
    icon: 'clock',
    route: '/admin/orari',
    parentKey: null,
  },
  {
    key: 'admin.brand',
    labelKey: 'nav.brand',
    icon: 'palette',
    route: '/admin/brand',
    parentKey: null,
  },
  {
    key: 'admin.settings',
    labelKey: 'nav.settings',
    icon: 'sliders-horizontal',
    route: '/admin/impostazioni',
    parentKey: null,
  },
]

export const platformNavigation: NavigationItem[] = [
  {
    key: 'platform.tenants',
    labelKey: 'nav.tenants',
    icon: 'building-2',
    route: '/platform/tenant',
    parentKey: null,
  },
  {
    key: 'platform.navigation',
    labelKey: 'nav.navigation',
    icon: 'panel-left',
    route: '/platform/navigazione',
    parentKey: null,
  },
]

export const customerMe: MeResponse = {
  id: '01a1eeca-0000-7000-8000-00000000c11e',
  email: 'cliente@bookly.local',
  firstName: 'Cliente',
  lastName: 'Demo',
  emailConfirmed: true,
  platformRoles: [],
  memberships: [],
}

export const demoTenant: PublicTenant = {
  slug: 'barberia-demo',
  name: 'Barberia Demo',
  phone: '059 000 0000',
  address: 'Via Esempio 1, Modena',
  timeZone: 'Europe/Rome',
  cancellationWindowHours: 12,
  bookingHorizonDays: 60,
  brand: { primaryColor: '#e8b05a', ground: 'Dark', headingFont: 'Script', hasLogo: false },
}

export const demoServices: PublicService[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Taglio',
    description: null,
    durationMinutes: 30,
    priceCents: 2500,
    priceIsFrom: false,
    staff: [{ id: '22222222-2222-4222-8222-222222222222', displayName: 'Barbiere 1' }],
  },
]

export function demoAppointment(overrides: Partial<MyAppointment> = {}): MyAppointment {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tenant: {
      slug: 'barberia-demo',
      name: 'Barberia Demo',
      phone: '059 000 0000',
      address: 'Via Esempio 1, Modena',
      primaryColor: '#e8b05a',
      timeZone: 'Europe/Rome',
    },
    serviceName: 'Taglio',
    durationMinutes: 30,
    priceCents: 2500,
    priceIsFrom: false,
    staffName: 'Barbiere 1',
    start: '2099-03-02T10:00:00+01:00',
    end: '2099-03-02T10:30:00+01:00',
    status: 'Confirmed',
    note: null,
    canCancel: true,
    cancelDeadline: '2099-03-01T22:00:00+01:00',
    ...overrides,
  }
}

export const adminServices: AdminService[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Taglio',
    description: null,
    durationMinutes: 30,
    bufferMinutes: 10,
    priceCents: 2500,
    priceIsFrom: false,
    isActive: true,
    sortOrder: 1,
    staffIds: ['22222222-2222-4222-8222-222222222222'],
  },
]

export const adminStaff: AdminStaff[] = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    displayName: 'Barbiere 1',
    isActive: true,
    sortOrder: 1,
    hasLogin: false,
    isMe: false,
    serviceIds: ['11111111-1111-4111-8111-111111111111'],
  },
]

export const adminHours: WorkingInterval[] = [
  { dayOfWeek: 1, start: '09:00:00', end: '13:00:00' },
  { dayOfWeek: 1, start: '15:00:00', end: '19:00:00' },
]

export const adminTimeOff: TimeOff[] = []

export const adminSettings: TenantSettings = {
  slug: 'barberia-demo',
  name: 'Barberia Demo',
  phone: '059 000 0000',
  address: 'Via Esempio 1, Modena',
  timeZone: 'Europe/Rome',
  cancellationWindowHours: 12,
  slotIntervalMinutes: 15,
  minNoticeMinutes: 60,
  bookingHorizonDays: 60,
  notifyOnCustomerCancellation: true,
}

export const adminBrand: TenantBrandSettings = {
  primaryColor: '#e8b05a',
  ground: 'Dark',
  headingFont: 'Script',
  hasLogo: false,
}

export const handlers = [
  http.get('/api/auth/me', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/navigation/admin', () => HttpResponse.json(ownerNavigation)),
  http.get('/api/navigation/platform', () => HttpResponse.json(platformNavigation)),
  http.get('/api/admin/services', () => HttpResponse.json(adminServices)),
  http.get('/api/admin/staff', () => HttpResponse.json(adminStaff)),
  http.get('/api/admin/staff/:id/working-hours', () => HttpResponse.json(adminHours)),
  http.get('/api/admin/staff/:id/time-off', () => HttpResponse.json(adminTimeOff)),
  http.get('/api/admin/settings', () => HttpResponse.json(adminSettings)),
  http.get('/api/admin/brand', () => HttpResponse.json(adminBrand)),
  http.get('/api/public/tenants/barberia-demo', () => HttpResponse.json(demoTenant)),
  http.get('/api/public/tenants/barberia-demo/services', () => HttpResponse.json(demoServices)),
  http.get('/api/public/tenants/barberia-demo/availability/days', ({ request }) => {
    const url = new URL(request.url)
    const from = url.searchParams.get('from')!
    return HttpResponse.json({ timeZone: 'Europe/Rome', days: [{ date: from, available: true }] })
  }),
  http.get('/api/public/tenants/barberia-demo/availability', ({ request }) => {
    const date = new URL(request.url).searchParams.get('date')!
    return HttpResponse.json({
      date,
      timeZone: 'Europe/Rome',
      slots: [{ start: `${date}T09:00:00+01:00` }, { start: `${date}T09:15:00+01:00` }],
    })
  }),
  http.get('/api/public/tenants/:slug', () =>
    HttpResponse.json(
      { title: 'Not found', status: 404, code: 'tenant.not_found' },
      { status: 404 },
    ),
  ),
]

export const server = setupServer(...handlers)
