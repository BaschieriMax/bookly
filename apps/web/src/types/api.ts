import type { components } from './api.gen'

/** Friendly aliases of the generated OpenAPI types (never edit api.gen.ts by hand). */
type Schemas = components['schemas']

export type MeResponse = Schemas['MeResponse']
export type Membership = Schemas['MembershipDto']
export type NavigationItem = Schemas['NavigationItemDto']
export type LoginRequest = Schemas['LoginRequest']
export type PublicTenant = Schemas['PublicTenantDto']
export type PublicService = Schemas['PublicServiceDto']
export type PublicAvailability = Schemas['PublicAvailabilityDto']
export type PublicDays = Schemas['PublicDaysDto']
export type MyAppointment = Schemas['MyAppointmentDto']
export type CreateAppointmentRequest = Schemas['CreateAppointmentRequest']
export type RegisterRequest = Schemas['RegisterRequest']
