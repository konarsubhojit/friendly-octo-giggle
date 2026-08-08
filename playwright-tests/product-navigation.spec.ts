/**
 * Product navigation regression tests.
 *
 * The product search dropdown and the shop filter / suggestion controls
 * navigate via `router.push()` from a `<button>`, so they are exercised here
 * by actually clicking and asserting the resulting URL and that the
 * destination page renders (no 404).
 */
import { expect, test, type Page } from '@playwright/test'

const PRODUCT_URL = /\/products\/[A-Za-z0-9]+/

/** Collect the product detail hrefs rendered in the shop product grid. */
const getGridProductHrefs = async (page: Page): Promise<string[]> => {
  // The grid renders product anchors after hydration, so wait for at least one
  // before reading hrefs to avoid a race on a freshly-loaded page.
  await page
    .locator('a[href*="/products/"]')
    .first()
    .waitFor({ state: 'attached' })
  return page.$$eval('a[href*="/products/"]', (anchors) =>
    Array.from(
      new Set(
        anchors
          .map((anchor) => anchor.getAttribute('href') ?? '')
          .filter((href) => /\/products\/[A-Za-z0-9]+$/.test(href))
      )
    )
  )
}

test.describe('product navigation (no 404 regression)', () => {
  test('every shop product link points at a product detail URL', async ({
    page,
  }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    const hrefs = await getGridProductHrefs(page)
    expect(
      hrefs.length,
      'shop should render at least one product'
    ).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(href, `product href ${href} must be un-prefixed`).toMatch(
        /^\/products\//
      )
    }
  })

  test('clicking a bestseller opens the product page (not 404)', async ({
    page,
  }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    const bestseller = page
      .getByRole('link', { name: /view bestseller/i })
      .first()
    await expect(bestseller).toBeVisible()
    await bestseller.click()
    await expect(page).toHaveURL(PRODUCT_URL)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/this page could not be found/i)).toHaveCount(0)
  })

  test('clicking a product grid card opens the product page (not 404)', async ({
    page,
  }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    const hrefs = await getGridProductHrefs(page)
    expect(hrefs.length).toBeGreaterThan(0)
    const card = page.locator(`a[href="${hrefs[0]}"]`).first()
    await card.click()
    await expect(page).toHaveURL((url) => url.pathname === hrefs[0])
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/this page could not be found/i)).toHaveCount(0)
  })

  test('search dropdown result navigates to the product URL', async ({
    page,
  }) => {
    await page.route('**/api/search?**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            results: [
              {
                id: 'ruJaxwb',
                name: 'Crochet Keychain',
                description: 'Handmade keychain',
                price: 10,
                image: '',
                category: 'Keychains',
              },
            ],
          },
        },
      })
    )
    await page.goto('/shop', { waitUntil: 'networkidle' })

    await page
      .getByRole('button', { name: /search products/i })
      .first()
      .click()
    const dialog = page.getByRole('dialog', { name: /search products/i })
    const searchbox = dialog.getByRole('searchbox', {
      name: /search products/i,
    })
    await expect(searchbox).toBeVisible()
    await searchbox.fill('crochet')

    const firstResult = dialog.getByRole('listitem').getByRole('button').first()
    await expect(firstResult).toBeVisible()
    await firstResult.click()

    await expect(page).toHaveURL(PRODUCT_URL)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/this page could not be found/i)).toHaveCount(0)
  })

  test('applying a shop filter keeps the URL on /shop', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    await page
      .getByRole('combobox', { name: /sort products/i })
      .selectOption('newest')
    await page.getByRole('button', { name: /^apply$/i }).click()
    // The shop filter navigates via router.push(). A query string is only
    // added for non-default filters, so assert the /shop path rather than
    // requiring a `?`.
    await expect(page).toHaveURL(/\/shop(\?|#|$)/)
    await expect(page.getByText(/this page could not be found/i)).toHaveCount(0)
  })
})

/**
 * Server-rendered product detail guard for the Cache Components migration.
 *
 * The product itself is read in a `"use cache"` scope and the request-scoped
 * region streams behind a Suspense boundary; with JavaScript disabled neither
 * can be filled in on the client, so everything asserted here must have been
 * produced by the server. Counts and text content are asserted rather than
 * visibility because React leaves streamed boundaries in hidden containers
 * when its inline swap script cannot run.
 */
test.describe('product detail renders server-side without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('initial HTML contains name, description, price and variant options', async ({
    page,
  }) => {
    await page.goto('/shop', { waitUntil: 'load' })

    const card = page.locator('a[href*="/products/"]').first()
    const href = await card.getAttribute('href')
    expect(href, 'shop should render at least one product').toBeTruthy()
    const name = (await card.locator('h3').first().textContent())?.trim() ?? ''
    const description =
      (await card.locator('p').first().textContent())?.trim() ?? ''
    expect(name, 'grid card should expose a product name').not.toBe('')

    await page.goto(href as string, { waitUntil: 'load' })

    await expect(
      page.getByRole('heading', { level: 1 }),
      'product name must be server-rendered'
    ).toHaveText(name)

    if (description !== '') {
      await expect(
        page.locator('p', { hasText: description }),
        'product description must be server-rendered'
      ).not.toHaveCount(0)
    }

    await expect(
      page.locator('body'),
      'a formatted price must be server-rendered'
    ).toContainText(/[₹$€£]\s?\d/)

    await expect(
      page.locator('#variant-selector-label'),
      'variant options must be server-rendered'
    ).not.toHaveCount(0)
  })
})
