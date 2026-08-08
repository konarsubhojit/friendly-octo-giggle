import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Self-service returns.
 *
 * The admin queue is driven through route interception rather than a seeded
 * database so the lifecycle assertions stay deterministic: a real queue would
 * carry whatever returns the environment happens to hold.
 */

const RETURN_ID = 'r7N8p9Q'
const ORDER_ID = 'ORD1234567'

const adminReturn = (overrides: Record<string, unknown> = {}) => ({
  id: RETURN_ID,
  orderId: ORDER_ID,
  status: 'REQUESTED',
  reason: 'DAMAGED',
  customerNote: 'Handle snapped in transit',
  decisionReason: null,
  customerName: 'Test Customer',
  customerEmail: 'customer@example.com',
  paymentProvider: 'RAZORPAY',
  refundAmount: 1200,
  refundId: null,
  createdAt: '2026-02-01T00:00:00.000Z',
  items: [{ orderItemId: 'itemAAA', quantity: 1, refundableAmount: 1200 }],
  evidence: [],
  ...overrides,
})

const mockExchangeRates = (page: Page) =>
  page.route('**/api/exchange-rates**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 } },
      },
    })
  )

test.describe('returns policy pages', () => {
  test('states the in-product return route, not an email-only one', async ({
    page,
  }) => {
    await page.goto('/returns')

    // The published promise has to match the shipped mechanism; a page still
    // telling customers to email support contradicts the feature.
    await expect(page.getByText(/start a return/i).first()).toBeVisible()
    await expect(
      page.getByText(/within 7 days of delivery/i).first()
    ).toBeVisible()
  })

  test('no longer claims refunds are never issued', async ({ page }) => {
    await page.goto('/returns')

    await expect(
      page.getByText('Refunds are not issued for orders.')
    ).toHaveCount(0)
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/returns')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
})

test.describe('admin returns queue', () => {
  test.use({ storageState: './playwright-tests/.auth/admin.json' })

  test('lists the pending queue and records a decision', async ({ page }) => {
    let decision: Record<string, unknown> | null = null
    let approved = false

    await mockExchangeRates(page)

    await page.route('**/api/admin/returns/*', async (route) => {
      decision = route.request().postDataJSON()
      approved = true
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: RETURN_ID,
            status: 'APPROVED',
            restocked: false,
            refund: null,
          },
        },
      })
    })

    await page.route('**/api/admin/returns?**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            returns: [
              approved
                ? adminReturn({
                    status: 'APPROVED',
                    decisionReason: 'Photos show breakage',
                  })
                : adminReturn(),
            ],
            nextCursor: null,
          },
        },
      })
    )

    await page.goto('/admin/returns')

    await expect(page.getByText(ORDER_ID.toUpperCase())).toBeVisible()

    // A decision without a reason must be refused client-side as well as
    // server-side, because the reason is shown to the customer.
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText(/reason is required/i)).toBeVisible()
    expect(decision).toBeNull()

    await page.getByRole('textbox').first().fill('Photos show breakage')
    await page.getByRole('button', { name: 'Approve' }).click()

    await expect
      .poll(() => decision)
      .toMatchObject({
        action: 'approve',
        decisionReason: 'Photos show breakage',
      })
  })

  test('is operable from the keyboard alone', async ({ page }) => {
    await mockExchangeRates(page)
    await page.route('**/api/admin/returns?**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { returns: [adminReturn()], nextCursor: null },
        },
      })
    )

    await page.goto('/admin/returns')
    await expect(page.getByText(ORDER_ID.toUpperCase())).toBeVisible()

    // Every control the operator needs must be reachable by tabbing; a queue
    // that requires a mouse excludes screen-reader and motor-impaired users.
    const focusable = page.locator(
      'button:visible, [href]:visible, input:visible, textarea:visible, select:visible'
    )
    expect(await focusable.count()).toBeGreaterThan(0)

    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).not.toBe('BODY')
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await mockExchangeRates(page)
    await page.route('**/api/admin/returns?**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { returns: [adminReturn()], nextCursor: null },
        },
      })
    )

    await page.goto('/admin/returns')
    await expect(page.getByText(ORDER_ID.toUpperCase())).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
})
