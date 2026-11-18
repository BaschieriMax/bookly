import { knownRoutes } from '@/app/paths'
import i18n from '@/i18n'
import type { NavigationItem } from '@/types/api'
import { iconRegistry } from './iconRegistry'

/** Server labels are i18n keys like "nav.calendar" (namespace.key). */
export function translateLabel(labelKey: string): string {
  const [ns, ...rest] = labelKey.split('.')
  const translate = i18n.t.bind(i18n) as (
    key: string,
    options: { ns?: string; defaultValue: string },
  ) => string
  return translate(rest.join('.'), { ns, defaultValue: labelKey })
}

/** Keeps only items whose icon is allowlisted and whose route exists in the client router. */
export function usableItems(items: readonly NavigationItem[]): NavigationItem[] {
  return items.filter((item) => {
    const usable = item.icon in iconRegistry && knownRoutes.has(item.route)
    if (!usable && import.meta.env.DEV) {
      console.warn(`[navigation] ignored item "${item.key}": unknown icon or route`, item)
    }
    return usable
  })
}
