import { useEffect } from 'react'
import type { PublicTenant } from '@/types/api'
import { tenantIconUrl, tenantManifestUrl } from './tenantApi'

/** The shell's own values (index.html, ShellTags on the server): Turnora's. */
const SHELL_DEFAULTS = {
  icon: '/apple-touch-icon.png',
  manifest: '/manifest.webmanifest',
  title: 'Turnora',
}

const ICON = 'link[rel="apple-touch-icon"]'
const MANIFEST = 'link[rel="manifest"]'
const TITLE = 'meta[name="apple-mobile-web-app-title"]'

/**
 * DEC-043: while a tenant page is open, adding it to the home screen proposes the business name
 * and its icon (Turnora's when it has none). The server writes the same tags when the page is
 * opened directly; this keeps them right when the customer arrives from inside the app, and puts
 * Turnora's back on leaving.
 */
export function useHomeScreenMeta(tenant: PublicTenant | undefined) {
  const slug = tenant?.slug
  const name = tenant?.name
  const hasIcon = tenant?.brand.hasHomeIcon ?? false

  useEffect(() => {
    if (!slug || !name) {
      return
    }
    setAttribute(ICON, 'href', hasIcon ? tenantIconUrl(slug) : SHELL_DEFAULTS.icon)
    setAttribute(MANIFEST, 'href', tenantManifestUrl(slug))
    setAttribute(TITLE, 'content', name)
    return () => {
      setAttribute(ICON, 'href', SHELL_DEFAULTS.icon)
      setAttribute(MANIFEST, 'href', SHELL_DEFAULTS.manifest)
      setAttribute(TITLE, 'content', SHELL_DEFAULTS.title)
    }
  }, [slug, name, hasIcon])
}

function setAttribute(selector: string, attribute: string, value: string) {
  document.head.querySelector(selector)?.setAttribute(attribute, value)
}
