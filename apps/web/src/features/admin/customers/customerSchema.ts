import { z } from 'zod'
import { requiredText } from '../formHelpers'

/**
 * A customer of the address book, as entered by the business. Mirrors NewCustomerRequest and
 * UpdateCustomerRequest in the API, which stay the source of truth.
 */
export const customerSchema = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  phone: requiredText(30).regex(/^(?=(?:\D*\d){6})\+?[0-9\s./()-]+$/, { error: 'phone' }),
  email: z.union([z.literal(''), z.email({ error: 'email' }).max(256, { error: 'tooLong' })]),
})

export type CustomerInput = z.infer<typeof customerSchema>
