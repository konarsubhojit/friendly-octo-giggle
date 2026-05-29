import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type AppLocale,
  getLocaleFromPathname,
  isSupportedLocale,
  stripLocaleFromPathname,
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
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next()
  }

  const localeFromPath = getLocaleFromPathname(pathname)
  if (!localeFromPath) {
    const locale = getPreferredLocale(request)
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = toLocalizedPathname(pathname, locale)
    redirectUrl.search = search
    return NextResponse.redirect(redirectUrl)
  }

  const rewriteUrl = request.nextUrl.clone()
  rewriteUrl.pathname = stripLocaleFromPathname(pathname)
  rewriteUrl.search = search

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-locale', localeFromPath)

  const response = NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  })
  response.cookies.set(LOCALE_COOKIE_NAME, localeFromPath, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
