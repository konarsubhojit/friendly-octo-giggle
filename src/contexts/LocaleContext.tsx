'use client'

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  useCallback,
} from 'react'
import {
  type AppLocale,
  DEFAULT_LOCALE,
  toLocalizedPathname,
} from '@/lib/i18n/config'
import { getMessage, type MessageKey } from '@/lib/i18n/messages'

interface LocaleContextValue {
  locale: AppLocale
  t: (key: MessageKey) => string
  localizePath: (pathname: string) => string
}

const fallbackLocaleContext: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  t: (key) => getMessage(DEFAULT_LOCALE, key),
  localizePath: (pathname) => toLocalizedPathname(pathname, DEFAULT_LOCALE),
}

const LocaleContext = createContext<LocaleContextValue>(fallbackLocaleContext)

interface LocaleProviderProps {
  readonly locale: AppLocale
  readonly children: ReactNode
}

export function LocaleProvider({
  locale = DEFAULT_LOCALE,
  children,
}: LocaleProviderProps) {
  const t = useCallback((key: MessageKey) => getMessage(locale, key), [locale])
  // Now that locale is a real route segment (src/app/[locale]/...),
  // internal hrefs need to be prefixed with the current locale so client
  // navigations land directly on the locale-aware route segment without
  // bouncing through a middleware redirect. Idempotent: paths that already
  // start with /{locale}/ are returned unchanged.
  const localizePath = useCallback(
    (pathname: string) => toLocalizedPathname(pathname, locale),
    [locale]
  )

  const value = useMemo(
    () => ({ locale, t, localizePath }),
    [locale, t, localizePath]
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
