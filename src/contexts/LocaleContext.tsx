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
  stripLocaleFromPathname,
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
  localizePath: (pathname) => pathname,
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
  const localizePath = useCallback((pathname: string) => {
    const normalizedPathname = pathname.startsWith('/')
      ? pathname
      : `/${pathname}`
    return stripLocaleFromPathname(normalizedPathname)
  }, [])

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
