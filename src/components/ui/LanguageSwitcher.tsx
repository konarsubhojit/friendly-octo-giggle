'use client'

import { useTransition } from 'react'
import {
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  type AppLocale,
  toLocalizedPathname,
} from '@/lib/i18n/config'
import { useLocale } from '@/contexts/LocaleContext'
import { HeaderSelect } from '@/components/ui/HeaderSelect'

export default function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition()
  const { locale, t } = useLocale()

  const handleChange = (nextLocale: AppLocale) => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; samesite=lax`

    void fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localePreference: nextLocale }),
    }).catch(() => {})

    startTransition(() => {
      const currentPath =
        typeof globalThis.window === 'undefined'
          ? '/'
          : globalThis.window.location.pathname
      const nextPath = toLocalizedPathname(currentPath, nextLocale)
      if (typeof globalThis.window !== 'undefined') {
        globalThis.window.location.assign(nextPath)
      }
    })
  }

  return (
    <label className="sr-only sm:not-sr-only sm:text-xs sm:text-[var(--text-muted)] sm:flex sm:items-center sm:gap-2">
      <span className="hidden lg:inline">{t('header.language')}</span>
      <HeaderSelect
        className="px-2 py-1 text-xs"
        aria-label={t('header.language')}
        value={locale}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as AppLocale)}
      >
        {SUPPORTED_LOCALES.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {supportedLocale === 'en'
              ? t('header.languageEnglish')
              : t('header.languageSpanish')}
          </option>
        ))}
      </HeaderSelect>
    </label>
  )
}
