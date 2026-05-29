import type { MetadataRoute } from 'next'
import { SUPPORTED_LOCALES, toLocalizedPathname } from '@/lib/i18n/config'

const ROUTES = [
  '/',
  '/shop',
  '/about',
  '/contact',
  '/shipping',
  '/returns',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const entries: MetadataRoute.Sitemap = []

  for (const locale of SUPPORTED_LOCALES) {
    for (const route of ROUTES) {
      const localizedPath = toLocalizedPathname(route, locale)
      const alternateLanguages = Object.fromEntries(
        SUPPORTED_LOCALES.map((altLocale) => [
          altLocale,
          `${base}${toLocalizedPathname(route, altLocale)}`,
        ])
      )
      entries.push({
        url: `${base}${localizedPath}`,
        alternates: { languages: alternateLanguages },
      })
    }
  }

  return entries
}
