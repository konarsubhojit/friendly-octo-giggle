export const SUPPORTED_LOCALES = ['en', 'es'] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'en'
export const LOCALE_COOKIE_NAME = 'kiyon-locale'

// Future-friendly groundwork for upcoming RTL locales.
const RTL_LOCALES = new Set(['ar', 'he'])

export const isSupportedLocale = (value: string): value is AppLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value)

export const getLocaleDirection = (locale: string): 'ltr' | 'rtl' =>
  RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'

export const getLocaleFromPathname = (pathname: string): AppLocale | null => {
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  return firstSegment && isSupportedLocale(firstSegment) ? firstSegment : null
}

export const stripLocaleFromPathname = (pathname: string): string => {
  const locale = getLocaleFromPathname(pathname)
  if (!locale) return pathname
  const stripped = pathname.replace(`/${locale}`, '')
  return stripped || '/'
}

export const toLocalizedPathname = (
  pathname: string,
  locale: AppLocale
): string => {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const noLocalePath = stripLocaleFromPathname(normalized)
  if (noLocalePath === '/') return `/${locale}`
  return `/${locale}${noLocalePath}`
}
