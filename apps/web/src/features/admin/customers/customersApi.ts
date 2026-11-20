import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { saveDownloadedFile } from '@/lib/download'
import { apiClient } from '@/services/apiClient'
import { useActiveTenantStore } from '@/stores/activeTenantStore'
import type {
  CustomerAppointmentPage,
  CustomerDetail,
  CustomerList,
  EraseCustomerResult,
  UpdateCustomerRequest,
} from '@/types/api'
import { adminKeys } from '../adminApi'

/** "AddressBook": entered by the business (editable here); "Account": booked online (read-only). */
export type CustomerKind = 'AddressBook' | 'Account'
export type CustomerKindFilter = 'all' | CustomerKind
export type AppointmentsWhen = 'upcoming' | 'past'

export interface CustomerRef {
  kind: CustomerKind
  id: string
}

/** Page sizes of the API (CustomerDirectoryService): customers 50, appointments 10 at a time. */
export const CUSTOMER_PAGE_SIZE = 50
export const APPOINTMENT_PAGE_SIZE = 10

const segment = (kind: CustomerKind) => (kind === 'Account' ? 'account' : 'address-book')

export const customerKeys = {
  all: (tenantId: string | null) => ['admin', tenantId, 'customers'] as const,
  list: (tenantId: string | null, query: string, kind: CustomerKindFilter) =>
    ['admin', tenantId, 'customers', 'list', { query, kind }] as const,
  detail: (tenantId: string | null, { kind, id }: CustomerRef) =>
    ['admin', tenantId, 'customers', kind, id] as const,
  appointments: (tenantId: string | null, { kind, id }: CustomerRef, when: AppointmentsWhen) =>
    ['admin', tenantId, 'customers', kind, id, 'appointments', when] as const,
}

const useTenantId = () => useActiveTenantStore((s) => s.tenantId)

/** Pages of 50 sorted by last name; the caller debounces the search text. */
export function useCustomerList(query: string, kind: CustomerKindFilter) {
  const tenantId = useTenantId()
  const trimmed = query.trim()
  return useInfiniteQuery({
    queryKey: customerKeys.list(tenantId, trimmed, kind),
    queryFn: async ({ pageParam }) =>
      (
        await apiClient.get<CustomerList>('/admin/customers/list', {
          params: {
            q: trimmed || undefined,
            kind: kind === 'all' ? undefined : kind,
            page: pageParam,
            pageSize: CUSTOMER_PAGE_SIZE,
          },
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: tenantId !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useCustomer(customer: CustomerRef) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: customerKeys.detail(tenantId, customer),
    queryFn: async () =>
      (
        await apiClient.get<CustomerDetail>(
          `/admin/customers/${segment(customer.kind)}/${customer.id}`,
        )
      ).data,
    enabled: tenantId !== null,
    staleTime: 0,
  })
}

/** Upcoming soonest first, past newest first, ten at a time ("Mostra altri 10"). */
export function useCustomerAppointments(
  customer: CustomerRef,
  when: AppointmentsWhen,
  enabled: boolean,
) {
  const tenantId = useTenantId()
  return useInfiniteQuery({
    queryKey: customerKeys.appointments(tenantId, customer, when),
    queryFn: async ({ pageParam }) =>
      (
        await apiClient.get<CustomerAppointmentPage>(
          `/admin/customers/${segment(customer.kind)}/${customer.id}/appointments`,
          { params: { when, page: pageParam, pageSize: APPOINTMENT_PAGE_SIZE } },
        )
      ).data,
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: enabled && tenantId !== null,
    staleTime: 0,
  })
}

/** Corrects an address-book entry; names also appear in the calendar, so the whole area refreshes. */
export function useUpdateCustomer(id: string) {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateCustomerRequest) =>
      (await apiClient.put<CustomerDetail>(`/admin/customers/address-book/${id}`, body)).data,
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(tenantId, { kind: 'AddressBook', id }), customer)
      void queryClient.invalidateQueries({ queryKey: adminKeys.all(tenantId) })
    },
  })
}

/** GDPR access request: the JSON file of an address-book entry. */
export function useDownloadCustomer() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.get<Blob>(`/admin/customers/address-book/${id}/export`, {
        responseType: 'blob',
      })
      saveDownloadedFile(response, 'cliente.json')
    },
  })
}

/** GDPR erasure: anonymises the entry and cancels its future appointments (calendar included). */
export function useEraseCustomer() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.delete<EraseCustomerResult>(`/admin/customers/address-book/${id}`)).data,
    onSuccess: (_, id) => {
      queryClient.removeQueries({
        queryKey: customerKeys.detail(tenantId, { kind: 'AddressBook', id }),
      })
      void queryClient.invalidateQueries({ queryKey: adminKeys.all(tenantId) })
    },
  })
}
