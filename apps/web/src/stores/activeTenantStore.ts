import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * Tenant the user is currently managing in the admin area. Shared by the API client
 * (X-Bookly-Tenant header), the sidebar and the tenant switcher. The server always
 * re-validates it against the user's memberships.
 */
interface ActiveTenantState {
  tenantId: string | null
  setTenantId: (tenantId: string | null) => void
}

export const useActiveTenantStore = create<ActiveTenantState>()(
  persist(
    (set) => ({
      tenantId: null,
      setTenantId: (tenantId) => set({ tenantId }),
    }),
    {
      name: 'bookly.active-tenant',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
