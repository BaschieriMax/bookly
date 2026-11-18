import { createContext, use } from 'react'
import type { PublicTenant } from '@/types/api'

export const TenantContext = createContext<PublicTenant | null>(null)

/** Tenant loaded by the layout of /b/:slug. */
export function useCurrentTenant(): PublicTenant {
  const tenant = use(TenantContext)
  if (!tenant) throw new Error('useCurrentTenant must be used inside TenantLayout')
  return tenant
}
