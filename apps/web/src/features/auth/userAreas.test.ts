import { describe, expect, it } from 'vitest'
import { customerMe, ownerMe } from '@/test/server'
import type { MeResponse } from '@/types/api'
import { homePathFor, landingPath, userAreas } from './userAreas'

const superAdmin: MeResponse = { ...customerMe, platformRoles: ['SuperAdmin'] }
const superAdminOwner: MeResponse = { ...ownerMe, platformRoles: ['SuperAdmin'] }

describe('userAreas', () => {
  it('lists the areas each user can open, most specific first', () => {
    expect(userAreas(customerMe).map((a) => a.area)).toEqual(['account'])
    expect(userAreas(ownerMe).map((a) => a.area)).toEqual(['admin', 'account'])
    expect(userAreas(superAdmin).map((a) => a.area)).toEqual(['platform', 'account'])
    expect(userAreas(superAdminOwner).map((a) => a.area)).toEqual(['platform', 'admin', 'account'])
  })
})

describe('homePathFor', () => {
  it.each([
    ['anonymous', null, '/'],
    ['customer', customerMe, '/account/appuntamenti'],
    ['owner or staff', ownerMe, '/admin'],
    ['super-admin', superAdmin, '/platform/tenant'],
  ])('sends a %s to their own area', (_, me, expected) => {
    expect(homePathFor(me)).toBe(expected)
  })
})

describe('landingPath', () => {
  it('keeps the page the user was going to', () => {
    expect(landingPath(customerMe, '/b/barberia-demo/prenota')).toBe('/b/barberia-demo/prenota')
  })

  it.each([null, '/', '//evil.example', 'https://evil.example'])(
    'falls back to the user area when the redirect is %s',
    (redirect) => {
      expect(landingPath(ownerMe, redirect)).toBe('/admin')
    },
  )
})
