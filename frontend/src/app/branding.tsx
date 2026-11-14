import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { api } from '../api/client'

export type PublicBranding = {
  site_name: string
  site_name_en: string
  site_description: string
  logo_url: string | null
  favicon_url: string | null
}

export const DEFAULT_BRANDING: PublicBranding = {
  site_name: 'فودسک',
  site_name_en: 'Foodesk',
  site_description: 'سامانه رزرو غذای سازمانی',
  logo_url: null,
  favicon_url: null,
}

const BrandingContext = createContext<PublicBranding>(DEFAULT_BRANDING)

export function useBranding(): PublicBranding {
  return useContext(BrandingContext)
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING)

  useEffect(() => {
    const controller = new AbortController()

    api<PublicBranding>('/config', { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return

        setBranding({
          site_name: result.site_name || DEFAULT_BRANDING.site_name,
          site_name_en: result.site_name_en || DEFAULT_BRANDING.site_name_en,
          site_description:
            result.site_description || DEFAULT_BRANDING.site_description,
          logo_url: result.logo_url || null,
          favicon_url: result.favicon_url || null,
        })
      })
      .catch(() => {
        // Preserve default branding if the public API is unavailable.
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    document.title = `${branding.site_name} | ${branding.site_description}`

    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )
    if (description) {
      description.content = branding.site_description
    }

    const favicon = document.querySelector<HTMLLinkElement>(
      'link[rel="icon"]',
    )

    if (favicon && branding.favicon_url) {
      favicon.href = branding.favicon_url
      favicon.removeAttribute('type')
    }
  }, [branding])

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  )
}
