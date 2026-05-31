import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type AppLocale,
  getLocaleFromPathname,
  isSupportedLocale,
  toLocalizedPathname,
} from '@/lib/i18n/config'

const PUBLIC_FILE = /\.(.*)$/

const getPreferredLocale = (request: NextRequest): AppLocale => {
  const fromCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value
  if (fromCookie && isSupportedLocale(fromCookie)) return fromCookie

  const languageHeader = request.headers.get('accept-language')
  const firstLanguage = languageHeader?.split(',')[0]?.split('-')[0]
  if (firstLanguage && isSupportedLocale(firstLanguage)) return firstLanguage

  return DEFAULT_LOCALE
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (
    // Skip non-page requests; locale prefixes are only for user-facing routes.
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Routes now live under `src/app/[locale]/...`, so locale is a real URL
  // segment instead of a rewritten-away prefix. We only need to redirect
  // unprefixed requests to a locale-prefixed URL; the request then resolves
  // directly to the `[locale]` route segment and can be cached / ISR'd
  // without the root layout having to read request headers.
  const localeFromPath = getLocaleFromPathname(pathname)
  if (!localeFromPath) {
    const locale = getPreferredLocale(request)
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = toLocalizedPathname(pathname, locale)
    redirectUrl.search = search
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    return response
  }

  // Locale already present in the path — refresh the preference cookie so the
  // next bare-path visit lands on the same locale, then let the request fall
  // through to the route segment.
  const response = NextResponse.next()
  response.cookies.set(LOCALE_COOKIE_NAME, localeFromPath, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
