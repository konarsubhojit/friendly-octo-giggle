'use client'

import NextLink, { type LinkProps } from 'next/link'
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { useLocale } from '@/contexts/LocaleContext'

// Routes that should stay locale-agnostic: API endpoints, asset paths,
// auth callbacks, and anything that's clearly external.
const LOCALE_AGNOSTIC_PREFIXES = ['/api/', '/_next/', '/icons/', '/images/']

function shouldLocalize(href: string): boolean {
  if (!href.startsWith('/')) return false
  if (href.startsWith('//')) return false
  if (href.startsWith('/#')) return false
  return !LOCALE_AGNOSTIC_PREFIXES.some((prefix) => href.startsWith(prefix))
}

type LocaleLinkProps = Omit<LinkProps, 'href'> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | 'href'> & {
    href: string
    children?: ReactNode
  }

/**
 * Drop-in replacement for `next/link` that prepends the active locale to
 * internal hrefs so client navigations land directly on the correct
 * `src/app/[locale]/...` route segment instead of being bounced through a
 * middleware redirect.
 *
 * External URLs (anything not starting with `/`, plus `/api/...`, asset
 * paths, and hash-only fragments) are passed through unchanged.
 */
const LocaleLink = forwardRef<HTMLAnchorElement, LocaleLinkProps>(
  function LocaleLink({ href, ...rest }, ref) {
    const { localizePath } = useLocale()
    const finalHref = shouldLocalize(href) ? localizePath(href) : href
    return <NextLink ref={ref} href={finalHref} {...rest} />
  }
)

export default LocaleLink
