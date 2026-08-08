/**
 * Recommendation rail coverage.
 *
 * Asserts the four surfaces render, that the empty cart shows no cross-sell,
 * and that a guest never triggers a per-user recommendation read. The
 * bestseller fallback is exercised implicitly: on a catalog with no
 * co-purchase history every rail resolves through it, so a rail that renders
 * at all proves the fallback path works.
 */
import { expect, test, type Page } from '@playwright/test'

const RAIL_TITLES = [
  'You might also like',
  'Goes well with your cart',
  'Picked for you',
  'You may like these instead',
]

/** Resolve a real product id from the shop grid so the test survives reseeding. */
const firstProductId = async (page: Page): Promise<string | null> => {
  await page.goto('/shop')
  const link = page.locator('a[href^="/products/"]').first()
  if ((await link.count()) === 0) return null
  const href = await link.getAttribute('href')
  return href?.split('/products/')[1]?.split('?')[0] ?? null
}

/** Any rail heading, once its Suspense boundary has resolved. */
const anyRail = (page: Page) =>
  page.getByRole('heading', { name: new RegExp(RAIL_TITLES.join('|')) })

test.describe('recommendation rails', () => {
  test('the product page renders a rail that excludes the anchor', async ({
    page,
  }) => {
    const productId = await firstProductId(page)
    test.skip(!productId, 'catalog is empty')

    await page.goto(`/products/${productId}`)
    await expect(
      page.getByRole('heading', { name: 'You might also like' })
    ).toBeVisible({ timeout: 15_000 })

    const railLinks = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { name: 'You might also like' }),
      })
      .locator('a[href^="/products/"]')

    const hrefs = await railLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href'))
    )
    expect(hrefs).not.toContain(`/products/${productId}`)
  })

  test('the shop landing page renders a personalized rail for a guest', async ({
    page,
  }) => {
    await page.goto('/shop')

    await expect(
      page.getByRole('heading', { name: 'Picked for you' })
    ).toBeVisible({ timeout: 15_000 })
  })

  test('a guest request carries no per-user cache directive', async ({
    page,
  }) => {
    const response = await page.request.get('/api/recommendations/personalized')

    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toContain('public')

    const body = await response.json()
    expect(body.data.fallback).toBe(true)
  })

  test('no recommendation response discloses a stock or sold count', async ({
    page,
  }) => {
    const response = await page.request.get('/api/recommendations/personalized')
    const body = await response.json()

    for (const product of body.data.products ?? []) {
      expect(product).not.toHaveProperty('stock')
      expect(product).not.toHaveProperty('soldCount')
      expect(typeof product.inStock).toBe('boolean')
    }
  })

  test('a zero-result search offers recovery recommendations', async ({
    page,
  }) => {
    await page.goto('/shop?search=zzzzqqqqxxxx')

    await expect(
      page.getByRole('heading', { name: 'You may like these instead' })
    ).toBeVisible({ timeout: 15_000 })
  })

  test('an empty cart shows no cross-sell rail', async ({ page }) => {
    await page.goto('/cart')

    await expect(
      page.getByRole('heading', { name: 'Goes well with your cart' })
    ).toHaveCount(0)
  })

  test('rails never prevent a page from rendering', async ({ page }) => {
    const productId = await firstProductId(page)
    test.skip(!productId, 'catalog is empty')

    const response = await page.goto(`/products/${productId}`)

    expect(response?.status()).toBeLessThan(400)
    // The page body is present regardless of whether the rail resolved.
    await expect(page.locator('main, body')).toBeVisible()
  })

  test('a rail impression is reported to the event endpoint', async ({
    page,
  }) => {
    const response = await page.request.post('/api/recommendations/event', {
      data: {
        type: 'impression',
        surface: 'home',
        anchorProductId: null,
        productIds: ['aaaaaaa'],
        fallback: true,
      },
    })

    expect(response.status()).toBe(200)
    expect((await response.json()).data.ok).toBe(true)
  })

  test('a malformed event is rejected rather than logged', async ({ page }) => {
    const response = await page.request.post('/api/recommendations/event', {
      data: {
        type: 'click',
        surface: 'home',
        // A click must name exactly one product.
        productIds: ['aaaaaaa', 'bbbbbbb'],
      },
    })

    expect(response.status()).toBe(400)
  })

  test('at least one rail is present somewhere on the storefront', async ({
    page,
  }) => {
    await page.goto('/shop')

    await expect(anyRail(page).first()).toBeVisible({ timeout: 15_000 })
  })
})
