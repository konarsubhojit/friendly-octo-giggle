import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type AppLocale,
  isSupportedLocale,
} from '@/lib/i18n/config'

export const getRequestLocale = async (): Promise<AppLocale> => {
  const requestHeaders = await headers()
  const localeHeader = requestHeaders.get('x-locale')
  if (localeHeader && isSupportedLocale(localeHeader)) return localeHeader

  const localeCookie = (await cookies()).get(LOCALE_COOKIE_NAME)?.value
  if (localeCookie && isSupportedLocale(localeCookie)) return localeCookie

  return DEFAULT_LOCALE
}

type LocalizedContent = Record<string, { name?: string; description?: string }>

export const localizeProductContent = <
  T extends { name: string; description: string; localizedContent?: LocalizedContent },
>(
  product: T,
  locale: AppLocale
): T => {
  const localized = product.localizedContent?.[locale]
  if (!localized) return product
  return {
    ...product,
    name: localized.name || product.name,
    description: localized.description || product.description,
  }
}
