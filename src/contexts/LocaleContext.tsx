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

const LocaleContext = createContext<LocaleContextValue | null>(null)

interface LocaleProviderProps {
  readonly locale: AppLocale
  readonly children: ReactNode
}

export function LocaleProvider({
  locale = DEFAULT_LOCALE,
  children,
}: LocaleProviderProps) {
  const t = useCallback((key: MessageKey) => getMessage(locale, key), [locale])
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
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}
