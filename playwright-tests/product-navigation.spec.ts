/**
 * Product navigation regression tests.
 *
 * Guards against the 404 regression where client-side `router.push()` calls
 * navigated to non-localized internal paths (e.g. `/products/<id>` instead of
 * `/en/products/<id>`). Because all routes live under `src/app/[locale]/...`
 * with `dynamicParams = false` on the locale segment, an un-prefixed RSC
 * soft-navigation 404s instead of being redirected by middleware.
 *
 * `locale-links.spec.ts` already asserts that rendered `<a href>` attributes
 * are locale-prefixed, but the product search dropdown and the shop filter /
 * suggestion controls navigate via `router.push()` from a `<button>`, so they
 * are exercised here by actually clicking and asserting the resulting URL and
 * that the destination page renders (no 404).
 */
import { expect, test, type Page } from '@playwright/test'

const LOCALE_PRODUCT_URL = /\/en\/products\/[A-Za-z0-9]+/

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
  test('every shop product link points at a locale-prefixed URL', async ({
    page,
  }) => {
    await page.goto('/en/shop', { waitUntil: 'domcontentloaded' })
    const hrefs = await getGridProductHrefs(page)
    expect(hrefs.length, 'shop should render at least one product').toBeGreaterThan(
      0
    )
    for (const href of hrefs) {
      expect(href, `product href ${href} must be locale-prefixed`).toMatch(
        /^\/en\/products\//
      )
    }
  })

  test('clicking a bestseller opens the product page (not 404)', async ({
    page,
  }) => {
    await page.goto('/en/shop', { waitUntil: 'domcontentloaded' })
    const bestseller = page
      .getByRole('link', { name: /view bestseller/i })
      .first()
    await expect(bestseller).toBeVisible()
    await bestseller.click()
    await expect(page).toHaveURL(LOCALE_PRODUCT_URL)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/this page could not be found/i)).toHaveCount(0)
  })

  test('clicking a product grid card opens the product page (not 404)', async ({
    page,
  }) => {
    await page.goto('/en/shop', { waitUntil: 'domcontentloaded' })
    const hrefs = await getGridProductHrefs(page)
    expect(hrefs.length).toBeGreaterThan(0)
    const card = page.locator(`a[href="${hrefs[0]}"]`).first()
    await card.click()
    await expect(page).toHaveURL(new RegExp(hrefs[0].replace(/[/]/g, '\\/')))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/this page could not be found/i)).toHaveCount(0)
  })

  test('search dropdown result navigates to a locale-prefixed product URL', async ({
    page,
  }) => {
    await page.goto('/en/shop', { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: /search products/i }).first().click()
    const dialog = page.getByRole('dialog', { name: /search products/i })
    const searchbox = dialog.getByRole('searchbox', { name: /search products/i })
    await expect(searchbox).toBeVisible()
    await searchbox.fill('crochet')

    const firstResult = dialog
      .getByRole('listitem')
      .getByRole('button')
      .first()
    await expect(firstResult).toBeVisible()
    await firstResult.click()

    await expect(page).toHaveURL(LOCALE_PRODUCT_URL)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/this page could not be found/i)).toHaveCount(0)
  })

  test('applying a shop filter keeps the URL locale-prefixed', async ({
    page,
  }) => {
    await page.goto('/en/shop', { waitUntil: 'domcontentloaded' })
    await page.getByRole('combobox', { name: /sort products/i }).selectOption(
      'newest'
    )
    await page.getByRole('button', { name: /^apply$/i }).click()
    // The shop filter navigates via router.push(); the regression being guarded
    // is that the destination stays under the /en/ locale prefix (it previously
    // pushed an un-prefixed /shop path that 404'd). A query string is only added
    // for non-default filters, so assert the locale-prefixed /shop path rather
    // than requiring a `?`.
    await expect(page).toHaveURL(/\/en\/shop(\?|#|$)/)
    await expect(page.getByText(/this page could not be found/i)).toHaveCount(0)
  })
})
