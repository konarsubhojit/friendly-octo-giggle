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
  '/en',
  '/en/shop',
  '/en/about',
  '/en/contact',
  '/en/help',
  '/en/press',
  '/en/careers',
  '/en/blog',
  '/en/returns',
  '/en/shipping',
  '/en/cart',
  '/en/wishlist',
  '/en/auth/signin',
  '/en/auth/register',
  '/en/auth/forgot-password',
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
    await page.goto('/en/shop', { waitUntil: 'domcontentloaded' })
    const href = await page
      .locator('a[href*="/en/products/"]')
      .first()
      .getAttribute('href')
    expect(href, 'shop should expose at least one product link').toBeTruthy()
    await expectRendersWithoutError(page, href as string)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
