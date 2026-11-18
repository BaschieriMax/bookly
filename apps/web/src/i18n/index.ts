import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import account from './it/account.json'
import admin from './it/admin.json'
import auth from './it/auth.json'
import booking from './it/booking.json'
import common from './it/common.json'
import nav from './it/nav.json'

/** Italian only for now; texts live in JSON so English can be added without refactoring (DEC-015). */
export const resources = {
  it: { common, nav, auth, booking, account, admin },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'it',
  fallbackLng: 'it',
  defaultNS: 'common',
  ns: ['common', 'nav', 'auth', 'booking', 'account', 'admin'],
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
