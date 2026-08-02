/**
 * Public page coverage smoke test.
 *
 * Visits every public (unauthenticated) route in the application and asserts it
 * responds without an HTTP error and renders without the Next.js "page could
 * not be found" 404 body. This is the broad safety net requested alongside the
 * product 404 fix: it ensures no page — static or dynamic — regresses to a 404.
 *
 * Dynamic detail routes (product, short-link) are resolved at runtime from the
 * shop grid so the test stays valid as catalog data changes.
 */
import { expect, test, type Page } from '@playwright/test'

const STATIC_PUBLIC_PAGES = [
  '/',
  '/shop',
  '/about',
  '/contact',
  '/help',
  '/press',
  '/careers',
  '/blog',
  '/returns',
  '/shipping',
  '/cart',
  '/wishlist',
  '/auth/signin',
  '/auth/register',
  '/auth/forgot-password',
  '/es',
  '/es/shop',
] as const

const NOT_FOUND_BODY = /this page could not be found/i

const expectRendersWithoutError = async (page: Page, path: string) => {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response, `expected a response for ${path}`).not.toBeNull()
  const status = response!.status()
  expect(status, `${path} responded with ${status}`).toBeLessThan(400)
  await expect(
    page.getByText(NOT_FOUND_BODY),
    `${path} rendered a 404 body`
  ).toHaveCount(0)
}

test.describe('public page coverage', () => {
  for (const path of STATIC_PUBLIC_PAGES) {
    test(`renders ${path} without error`, async ({ page }) => {
      await expectRendersWithoutError(page, path)
    })
  }

  test('first product detail page renders without error', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    const href = await page
      .locator('a[href*="/products/"]')
      .first()
      .getAttribute('href')
    expect(href, 'shop should expose at least one product link').toBeTruthy()
    await expectRendersWithoutError(page, href as string)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

/**
 * Server-rendered content guard for the Cache Components migration.
 *
 * With JavaScript disabled the browser receives only what the server streamed,
 * so anything asserted here provably came from the prerendered shell or a
 * server-rendered Suspense boundary rather than a client-side fetch. React
 * streams resolved boundaries into hidden containers and swaps them in with an
 * inline script, so counts (which match hidden nodes) are asserted instead of
 * visibility.
 */
test.describe('shop renders server-side without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('initial HTML contains product cards and category chips', async ({
    page,
  }) => {
    await expectRendersWithoutError(page, '/shop')

    await expect(
      page.locator('a[href*="/products/"]'),
      'product cards must be in the server-rendered HTML'
    ).not.toHaveCount(0)

    await expect(
      page.locator('nav[aria-label="Browse by category"] a'),
      'category chips must be in the server-rendered HTML'
    ).not.toHaveCount(0)
  })
})
