import { paths } from '@/app/paths'
import type { MeResponse } from '@/types/api'
import { safeRedirect } from './safeRedirect'

export type UserArea = 'platform' | 'admin' | 'account'

export interface UserAreaLink {
  area: UserArea
  to: string
}

/** Areas a signed-in user can open, most specific first: platform, business admin, own bookings. */
export function userAreas(me: MeResponse): UserAreaLink[] {
  const areas: UserAreaLink[] = []
  if (me.platformRoles.includes('SuperAdmin')) {
    areas.push({ area: 'platform', to: paths.platform.tenants })
  }
  if (me.memberships.length > 0) {
    areas.push({ area: 'admin', to: paths.admin.calendar })
  }
  // Every account can book, so the customer area is always available.
  areas.push({ area: 'account', to: paths.myAppointments })
  return areas
}

/** Where a signed-in user belongs when no page was requested. */
export function homePathFor(me: MeResponse | null | undefined): string {
  return me ? userAreas(me)[0]!.to : paths.home
}

/**
 * Destination after login: the page the user was going to (only same-app paths, DEC-028),
 * otherwise their own area instead of the landing page.
 */
export function landingPath(me: MeResponse | null | undefined, redirect: string | null): string {
  const requested = safeRedirect(redirect)
  return requested !== paths.home ? requested : homePathFor(me)
}
