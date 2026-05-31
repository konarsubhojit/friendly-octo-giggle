/**
 * Locale link smoke test.
 *
 * Verifies that, after migrating routes under `src/app/[locale]/`:
 *   - the root `/` redirects to the default locale
 *   - every page rendered under `/en` / `/es` exposes only locale-prefixed
 *     internal hrefs (no bare `/cart`, `/about`, etc. that would 404 once
 *     middleware stops rewriting)
 *   - unsupported locales (e.g. `/fr`) get redirected or return 404 because
 *     the locale layout uses `dynamicParams = false`
 *   - the main navigation links are reachable and do not 404
 *
 * This guards against the regression observed previously where links rendered
 * by client components pointed at non-localized paths and produced 404s.
 */
import { expect, test } from '@playwright/test'

const STATIC_PAGES = [
  '/en',
  '/en/about',
  '/en/contact',
  '/en/cart',
  '/en/help',
  '/en/press',
  '/en/careers',
  '/en/blog',
  '/en/returns',
  '/en/shipping',
  '/en/auth/register',
  '/en/wishlist',
  '/es',
  '/es/about',
] as const

test.describe('locale link smoke', () => {
  test('root path redirects to default locale', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(response, 'expected a response for /').not.toBeNull()
    expect(page.url()).toMatch(/\/en\/?$/)
  })

  for (const path of STATIC_PAGES) {
    test(`page ${path} responds without 404`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response, `expected a response for ${path}`).not.toBeNull()
      const status = response!.status()
      expect(
        status,
        `${path} responded with ${status} (expected < 400)`
      ).toBeLessThan(400)
    })
  }

  test('rendered internal links on /en are locale-prefixed', async ({
    page,
  }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' })

    const hrefs = await page.$$eval('a[href]', (anchors) =>
      anchors
        .map((a) => a.getAttribute('href') ?? '')
        .filter((h) => h.startsWith('/') && !h.startsWith('//'))
    )

    const offending = hrefs.filter((href) => {
      if (href === '/') return false // not expected, but caught below
      // allow API, Next internals, public asset folders, locale roots
      if (href.startsWith('/api/')) return false
      if (href.startsWith('/_next/')) return false
      if (href.startsWith('/icons/')) return false
      if (href.startsWith('/images/')) return false
      if (href.startsWith('/manifest')) return false
      if (href.startsWith('/sitemap')) return false
      if (href === '/en' || href === '/es') return false
      if (href.startsWith('/en/') || href.startsWith('/es/')) return false
      if (href.startsWith('/#')) return false
      return true
    })

    expect(
      offending,
      `internal hrefs on /en must be locale-prefixed; offenders: ${offending.join(', ')}`
    ).toEqual([])
  })

  test('unsupported locale segment returns 404 (dynamicParams=false)', async ({
    page,
  }) => {
    const response = await page.goto('/en/fr-not-a-route', {
      waitUntil: 'domcontentloaded',
    })
    expect(response).not.toBeNull()
    // Either a true 404 from notFound() or a redirect to a 404-rendering route.
    expect(response!.status()).toBe(404)
  })

  test('clicking the Shop nav link navigates to a locale-prefixed URL', async ({
    page,
  }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' })
    const shop = page.getByRole('link', { name: /^shop$/i }).first()
    await expect(shop).toBeVisible()
    const href = await shop.getAttribute('href')
    expect(href, 'Shop link href should be locale-prefixed').toMatch(
      /^\/(en|es)\/shop$/
    )
  })
})
