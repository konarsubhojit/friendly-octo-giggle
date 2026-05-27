import { expect, test } from '@playwright/test'
import { MOCK_CART } from './mock-data.js'

test('shows recoverable error when checkout processing fails', async ({ page }) => {
  let attempt = 0

  await page.route('**/api/cart', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { cart: MOCK_CART } })
      return
    }
    await route.continue()
  })

  await page.route('**/api/account/addresses', (route) =>
    route.fulfill({ json: { success: true, data: { addresses: [] } } })
  )

  await page.route('**/api/checkout', (route) =>
    route.fulfill({
      status: 202,
      json: { checkoutRequestId: 'chk-test-err', status: 'PENDING' },
    })
  )

  await page.route('**/api/checkout/chk-test-err', (route) => {
    attempt += 1
    if (attempt === 1) {
      return route.fulfill({
        json: {
          checkoutRequestId: 'chk-test-err',
          status: 'FAILED',
          orderId: null,
          error: 'Queue submission failed',
        },
      })
    }
    return route.fulfill({
      json: {
        checkoutRequestId: 'chk-test-err',
        status: 'COMPLETED',
        orderId: 'ord-test-retry',
        error: null,
      },
    })
  })

  await page.route('**/api/orders/**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { order: { id: 'ord-test-retry', items: [], trackingNumber: null } },
      },
    })
  )

  await page.goto('/cart')
  await page.getByRole('link', { name: /continue to shipping/i }).click()
  await page.getByLabel(/address line 1/i).fill('42 MG Road')
  await page.getByLabel(/pin code/i).fill('560001')
  await page.getByLabel(/city/i).fill('Bengaluru')
  await page.getByLabel(/state/i).fill('Karnataka')
  await page.getByRole('button', { name: /continue to review/i }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /confirm and place order/i }).click()

  await expect(page.getByText(/queue submission failed/i)).toBeVisible()
  await page.getByRole('button', { name: /retry checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout\/confirmation\?orderId=ord-test-retry/)
})
