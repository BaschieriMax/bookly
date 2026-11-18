import { describe, expect, it, vi } from 'vitest'
import type { NavigationItem } from '@/types/api'
import { usableItems } from './navigationItems'

const item = (overrides: Partial<NavigationItem>): NavigationItem => ({
  key: 'admin.calendar',
  labelKey: 'nav.calendar',
  icon: 'calendar-days',
  route: '/admin',
  parentKey: null,
  ...overrides,
})

describe('usableItems', () => {
  it('drops items with an icon outside the allowlist or a route the client does not know', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = usableItems([
      item({}),
      item({ key: 'x.icon', icon: 'skull' }),
      item({ key: 'x.route', route: '/admin/non-esiste' }),
      item({ key: 'x.external', route: 'https://evil.example' }),
    ])

    expect(result.map((i) => i.key)).toEqual(['admin.calendar'])
    expect(warn).toHaveBeenCalledTimes(3)
  })
})
