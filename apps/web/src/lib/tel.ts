/**
 * href of a phone link: only digits and a leading "+". The phone fields also accept spaces,
 * dots, slashes and dashes ("059/123.45-67"), which are not valid in a tel: URI (RFC 3966).
 */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${digits}`
}
