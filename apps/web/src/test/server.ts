import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { MeResponse, NavigationItem } from '@/types/api'

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

export const handlers = [
  http.get('/api/auth/me', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/navigation/admin', () => HttpResponse.json(ownerNavigation)),
  http.get('/api/navigation/platform', () => HttpResponse.json(platformNavigation)),
]

export const server = setupServer(...handlers)
