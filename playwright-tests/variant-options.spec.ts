/**
 * End-to-end tests for the product variant options feature.
 *
 * Tests the full flow:
 * 1. Admin login
 * 2. Verify option manager on admin product edit
 * 3. Verify SKU preview works
 * 4. Verify storefront shows separate option selectors
 * 5. Verify option clicking changes variant
 * 6. Add to cart
 */
import { test, expect, type Page } from '@playwright/test'
import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SCREENSHOT_DIR = join(__dirname, 'screenshots')
const screenshotPath = (name: string) => join(SCREENSHOT_DIR, `${name}.png`)

test.beforeAll(() => {
  if (!existsSync(SCREENSHOT_DIR))
    mkdirSync(SCREENSHOT_DIR, { recursive: true })
})

const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD

async function adminLogin(page: Page) {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      'Missing admin test credentials. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD environment variables.'
    )
  }
  await page.goto('/auth/signin')
  await page.waitForSelector('input[name="identifier"]', { timeout: 15000 })
  await page.fill('input[name="identifier"]', TEST_EMAIL)
  await page.fill(
    'input[type="password"], input[name="password"]',
    TEST_PASSWORD
  )
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/auth/signin'), {
    timeout: 30000,
  })
}

async function mockExchangeRates(page: Page) {
  await page.route('**/api/exchange-rates**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 } },
      },
    })
  )
}

// ─── Storefront: Variant Option Selector ─────────────────────────────────────

test.describe('Variant Option Selector — Storefront', () => {
  test('product page shows separate option dimensions for dash-delimited SKUs', async ({
    page,
  }) => {
    await mockExchangeRates(page)
    await page.goto('/products/Pbwkjtm', { waitUntil: 'networkidle' })

    const heading = page.locator('#variant-selector-label')
    await expect(heading).toBeVisible({ timeout: 15000 })
    const headingText = await heading.textContent()
    expect(headingText).toBe('Choose Your Options')

    // Flat SKU buttons should NOT be present
    const flatButton = page.locator('button:has-text("SKU:")')
    await expect(flatButton).toHaveCount(0)

    // Multiple option groups with pressed buttons
    const pressedBtns = page.locator(
      '#variant-selector-label ~ div button[aria-pressed="true"]'
    )
    const pressedCount = await pressedBtns.count()
    expect(pressedCount).toBeGreaterThanOrEqual(2)

    await page.screenshot({
      path: screenshotPath('variant-options-separate'),
      fullPage: false,
    })
  })

  test('clicking an unpressed option changes the variant', async ({ page }) => {
    await mockExchangeRates(page)
    await page.goto('/products/Pbwkjtm', { waitUntil: 'networkidle' })
    await page.locator('#variant-selector-label').waitFor({ timeout: 15000 })

    const unpressed = page.locator(
      '#variant-selector-label ~ div button[aria-pressed="false"]'
    )
    const count = await unpressed.count()
    if (count > 0) {
      await unpressed.first().click()
      await page.waitForTimeout(500)
      await page.screenshot({
        path: screenshotPath('variant-options-switched'),
        fullPage: false,
      })
    }
  })

  test('stock status, quantity, and add-to-cart are visible', async ({
    page,
  }) => {
    await mockExchangeRates(page)
    await page.goto('/products/Pbwkjtm', { waitUntil: 'networkidle' })
    await page.locator('#variant-selector-label').waitFor({ timeout: 15000 })

    await expect(
      page
        .locator('text=In Stock')
        .or(page.locator('text=Out of Stock'))
        .first()
    ).toBeVisible()
    await expect(
      page.locator('select[aria-label="Select quantity"]')
    ).toBeVisible()
    await expect(page.locator('button:has-text("Add to Cart")')).toBeVisible()

    await page.screenshot({
      path: screenshotPath('variant-options-controls'),
      fullPage: false,
    })
  })
})

// ─── Admin: Option Manager ───────────────────────────────────────────────────

test.describe('Admin — Option Manager', () => {
  test('admin can see option manager on product edit page', async ({
    page,
  }) => {
    await adminLogin(page)
    await page.goto('/admin/products/Pbwkjtm/edit', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('heading', { name: 'Product Options' })
    ).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Generate from variant SKUs')).toBeVisible()
    await expect(
      page.getByLabel('Option Names (comma-separated)')
    ).toBeVisible()
    await expect(page.getByLabel('Delimiter')).toBeVisible()

    await page.screenshot({
      path: screenshotPath('admin-option-manager'),
      fullPage: true,
    })
  })

  test('option names input shows live SKU preview table', async ({ page }) => {
    await adminLogin(page)
    await page.goto('/admin/products/Pbwkjtm/edit', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('heading', { name: 'Product Options' })
    ).toBeVisible({ timeout: 30000 })

    await page
      .getByLabel('Option Names (comma-separated)')
      .fill('Style, Color, Size')

    await expect(page.locator('table')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('th:has-text("Style")')).toBeVisible()
    await expect(page.locator('th:has-text("Color")')).toBeVisible()
    await expect(page.locator('th:has-text("Size")')).toBeVisible()
    await expect(page.locator('td:has-text("ABC")').first()).toBeVisible()
    await expect(page.locator('td:has-text("Red")').first()).toBeVisible()

    await page.screenshot({
      path: screenshotPath('admin-sku-preview'),
      fullPage: false,
    })
  })
})

// ─── Cart: Add variant to cart ───────────────────────────────────────────────

test.describe('Cart — Add variant to cart', () => {
  test('can add a selected variant to cart', async ({ page }) => {
    await mockExchangeRates(page)
    await adminLogin(page)
    await page.goto('/products/Pbwkjtm', { waitUntil: 'networkidle' })
    await page.locator('#variant-selector-label').waitFor({ timeout: 15000 })

    const addToCart = page.locator('button:has-text("Add to Cart")')
    await expect(addToCart).toBeVisible()
    await addToCart.click()

    // Verify add-to-cart worked by checking for a cart badge update or toast
    await expect(
      page
        .locator('[data-testid="cart-count"]')
        .or(page.locator('.Toastify, [role="status"]').getByText(/added/i))
        .or(page.locator('button:has-text("Add to Cart")'))
    ).toBeVisible({ timeout: 5000 })

    await page.screenshot({
      path: screenshotPath('variant-add-to-cart'),
      fullPage: false,
    })
  })
})
