import type { components } from './api.gen'

/** Friendly aliases of the generated OpenAPI types (never edit api.gen.ts by hand). */
type Schemas = components['schemas']

export type MeResponse = Schemas['MeResponse']
export type Membership = Schemas['MembershipDto']
export type NavigationItem = Schemas['NavigationItemDto']
export type LoginRequest = Schemas['LoginRequest']
