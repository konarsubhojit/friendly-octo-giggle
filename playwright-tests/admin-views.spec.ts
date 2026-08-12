/**
 * Admin view tests — run as an authenticated admin account using the stored
 * session state from global-setup.ts.
 *
 * Every admin API call is intercepted by Playwright route mocks so the
 * tests are fully deterministic and require no real database.
 */
import { test, expect, Page } from '@playwright/test'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  MOCK_PRODUCTS,
  MOCK_ORDERS,
  MOCK_USERS,
  MOCK_SALES,
  MOCK_ACTIVITY_ENTRIES,
} from './mock-data.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')
const ADMIN_ORDER_DETAIL_PATTERN = /\/api\/admin\/orders\/[^/]+$/
const ADMIN_USER_DETAIL_PATTERN = /\/api\/admin\/users\/[^/]+$/

function screenshotPath(name: string) {
  return path.join(SCREENSHOT_DIR, `${name}.png`)
}

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
})

// ─── Route mocks ─────────────────────────────────────────────────────────────

async function mockAdminRoutes(page: Page) {
  await page.route('**/api/admin/sales**', (route) =>
    route.fulfill({ json: { success: true, data: { sales: MOCK_SALES } } })
  )
  await page.route('**/api/admin/products**', (route) =>
    route.fulfill({
      json: { success: true, data: { products: MOCK_PRODUCTS } },
    })
  )
  await page.route('**/api/admin/orders**', (route) => {
    const url = route.request().url()
    if (ADMIN_ORDER_DETAIL_PATTERN.test(url)) {
      return route.fulfill({
        json: { success: true, data: { order: MOCK_ORDERS[0] } },
      })
    }
    return route.fulfill({
      json: { success: true, data: { orders: MOCK_ORDERS } },
    })
  })
  await page.route('**/api/admin/users**', (route) => {
    const url = route.request().url()
    if (ADMIN_USER_DETAIL_PATTERN.test(url)) {
      return route.fulfill({
        json: { success: true, data: { user: MOCK_USERS[0] } },
      })
    }
    return route.fulfill({
      json: { success: true, data: { users: MOCK_USERS } },
    })
  })
  // Suppress exchange-rates errors (Redis not available)
  await page.route('**/api/exchange-rates**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 } },
      },
    })
  )
  // Activity log (T051) — filters the in-memory fixture the same way the
  // real API filters by entity/entityId/action so combined filtering can be
  // exercised deterministically without a database.
  await page.route('**/api/admin/activity**', (route) => {
    const url = new URL(route.request().url())
    const entity = url.searchParams.get('entity')
    const entityId = url.searchParams.get('entityId')
    const action = url.searchParams.get('action')
    const entries = MOCK_ACTIVITY_ENTRIES.filter(
      (entry) =>
        (!entity || entry.entity === entity) &&
        (!entityId || entry.entityId === entityId) &&
        (!action || entry.action === action)
    )
    return route.fulfill({
      json: {
        success: true,
        data: { entries, nextCursor: null, retentionWindowMonths: 24 },
      },
    })
  })
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

test.describe('Admin Dashboard', () => {
  test('renders dashboard with sales summary', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin')
    await expect(
      page.getByRole('heading', { name: /dashboard/i })
    ).toBeVisible()

    // Wait for loading state to clear and stat cards to appear
    await expect(page.getByText('Total Revenue')).toBeVisible()
    await expect(page.getByText(/lifetime non-cancelled orders/i)).toBeVisible()
    await page.screenshot({
      path: screenshotPath('admin-dashboard'),
      fullPage: true,
    })
  })

  test('top products table is visible', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin')
    // Wait for data to load (loading spinner disappears when data arrives)
    await expect(
      page.getByRole('heading', { name: /products driving revenue/i })
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: 'Product' })
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: /qty sold/i })
    ).toBeVisible()
    await page.screenshot({
      path: screenshotPath('admin-dashboard-table'),
      fullPage: true,
    })
  })

  test('nav links render all sections', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin')
    await expect(
      page.getByRole('link', { name: /products/i }).first()
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /orders/i }).first()
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /users/i }).first()
    ).toBeVisible()
  })
})

// ─── Admin Products ───────────────────────────────────────────────────────────

test.describe('Admin Products', () => {
  test('renders product grid with all mock products', async ({
    page,
  }, testInfo) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/products')
    await expect(
      page.getByRole('heading', { name: /product management/i })
    ).toBeVisible()

    // Wait for the Redux data to load — first product is the signal
    await expect(
      page.getByText('Hand-knitted Flower Bouquet').first()
    ).toBeVisible({ timeout: 10_000 })
    // All 6 products should appear
    for (const product of MOCK_PRODUCTS) {
      await expect(page.getByText(product.name).first()).toBeVisible()
    }
    await page.screenshot({
      path: screenshotPath(`admin-products-${testInfo.project.name}`),
      fullPage: true,
    })
  })

  test('product table shows price and stock columns', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/products', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: /product management/i })
    ).toBeVisible()
    await expect(page.getByText('Stock').first()).toBeVisible()
    await expect(page.getByText('Price').first()).toBeVisible()
  })

  test('Add Product button is visible', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/products')
    await expect(
      page.getByRole('button', { name: /add product/i })
    ).toBeVisible()
  })

  test('Open and Delete buttons in product table', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/products')
    await expect(
      page.getByText('Hand-knitted Flower Bouquet').first()
    ).toBeVisible({ timeout: 10_000 })
    const openLinks = page.getByRole('link', { name: /open/i })
    await expect(openLinks.first()).toBeVisible()
    const deleteBtns = page.getByRole('button', { name: /delete/i })
    await expect(deleteBtns.first()).toBeVisible()
  })
})

// ─── Admin Orders ─────────────────────────────────────────────────────────────

test.describe('Admin Orders', () => {
  test('renders order management with all mock orders', async ({
    page,
  }, testInfo) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/orders')
    await expect(
      page.getByRole('heading', {
        name: /order management/i,
      })
    ).toBeVisible()

    for (const order of MOCK_ORDERS) {
      await expect(page.getByText(order.customerName).first()).toBeVisible()
    }
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(hasHorizontalOverflow).toBe(false)
    await page.screenshot({
      path: screenshotPath(`admin-orders-${testInfo.project.name}`),
      fullPage: true,
    })
  })

  test('shows all order statuses', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/orders')
    const statuses = [
      'DELIVERED',
      'SHIPPED',
      'PROCESSING',
      'PENDING',
      'CANCELLED',
    ]
    for (const status of statuses) {
      await expect(page.getByText(status).first()).toBeVisible()
    }
    await page.screenshot({
      path: screenshotPath('admin-orders-statuses'),
      fullPage: true,
    })
  })

  test('shows customer names in order table', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/orders')
    await expect(page.getByText('Priya Sharma').first()).toBeVisible()
  })
})

// ─── Admin Users ──────────────────────────────────────────────────────────────

test.describe('Admin Users', () => {
  test('renders user management table with all mock users', async ({
    page,
  }, testInfo) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/users')
    await expect(
      page.getByRole('heading', { name: /user management/i })
    ).toBeVisible()

    for (const user of MOCK_USERS) {
      await expect(page.getByText(user.email)).toBeVisible()
    }
    await page.screenshot({
      path: screenshotPath(`admin-users-${testInfo.project.name}`),
      fullPage: true,
    })
  })

  test('uses a table on desktop and cards on mobile without viewport overflow', async ({
    page,
  }, testInfo) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/users')
    const usersView = page.getByLabel('Users')

    if (testInfo.project.name.includes('mobile')) {
      await expect(usersView.getByRole('list')).toBeVisible()
      await expect(usersView.getByRole('table')).toHaveCount(0)
    } else {
      await expect(usersView.getByRole('table')).toBeVisible()
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('shows ADMIN and CUSTOMER role badges', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/users')
    await expect(page.getByText('ADMIN').first()).toBeVisible()
    await expect(page.getByText('CUSTOMER').first()).toBeVisible()
  })

  test('users page - mobile view card layout', async ({ page }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes('mobile'),
      'Only runs on mobile viewport'
    )
    await mockAdminRoutes(page)
    await page.goto('/admin/users')
    await expect(page.getByText(MOCK_USERS[0].email)).toBeVisible()
    await page.screenshot({
      path: screenshotPath('admin-users-mobile'),
      fullPage: true,
    })
  })
})

// ─── Admin header and nav ─────────────────────────────────────────────────────

test.describe('Admin layout', () => {
  test('shows logged-in user name in header', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin')
    await expect(page.getByText(/copilot admin/i)).toBeVisible()
  })

  test('dropdown menus stay attached to the trigger after scrolling', async ({
    page,
  }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/orders')
    await expect(
      page.getByRole('heading', {
        name: /order management/i,
      })
    ).toBeVisible()

    const trigger = page.getByRole('button', { name: 'Catalog' })
    await trigger.click()

    await page.evaluate(() => window.scrollTo(0, 500))

    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()

    const [triggerBox, menuBox] = await Promise.all([
      trigger.boundingBox(),
      menu.boundingBox(),
    ])

    expect(triggerBox).not.toBeNull()
    expect(menuBox).not.toBeNull()

    if (!triggerBox || !menuBox) {
      throw new Error('Expected dropdown trigger and menu to have layout boxes')
    }

    expect(
      Math.abs(menuBox.y - (triggerBox.y + triggerBox.height))
    ).toBeLessThanOrEqual(1)
  })

  test('quick navigation filters admin destinations', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin')

    await page.getByRole('button', { name: /quick navigation/i }).click()
    const dialog = page.getByRole('dialog', {
      name: /admin quick navigation/i,
    })
    await expect(dialog).toBeVisible()

    await page.getByPlaceholder('Jump to admin section...').fill('email')
    await expect(dialog.getByText('Email Failures')).toBeVisible()
    await expect(dialog.getByText('No matching sections')).not.toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('nav links are scrollable on mobile', async ({ page }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes('mobile'),
      'Only runs on mobile viewport'
    )
    await mockAdminRoutes(page)
    await page.goto('/admin')
    const nav = page
      .locator('nav.overflow-x-auto, nav .overflow-x-auto')
      .first()
    await expect(nav).toBeAttached()
    await page.screenshot({
      path: screenshotPath('admin-nav-mobile'),
      fullPage: false,
    })
  })
})

// ─── Admin gate under Cache Components (FR-008 acceptance 4) ─────────────────

/**
 * Under `cacheComponents: true` every admin page reports `◐` — a prerendered
 * shell plus streamed dynamic holes. The shell itself carries no user data,
 * but a shell that were served to an unauthorized visitor would still be a
 * disclosure of the admin surface. These tests prove the `src/proxy.ts` gate
 * runs ahead of any cached output: an unauthorized request is redirected or
 * refused, and its response body contains none of the admin chrome.
 *
 * The always-on case is "no session at all". When a non-staff credential is
 * supplied via `PLAYWRIGHT_CUSTOMER_EMAIL` / `PLAYWRIGHT_CUSTOMER_PASS`, the
 * stronger authenticated-but-unauthorized case runs as well.
 */
const ADMIN_SHELL_MARKERS = [
  'Product Management',
  'Order Management',
  'User Management',
  'Quick Navigation',
] as const

const CUSTOMER_EMAIL = process.env.PLAYWRIGHT_CUSTOMER_EMAIL
const CUSTOMER_PASS = process.env.PLAYWRIGHT_CUSTOMER_PASS

async function expectNoAdminShell(page: Page) {
  const html = await page.content()
  for (const marker of ADMIN_SHELL_MARKERS) {
    expect(html, `a rejected request rendered "${marker}"`).not.toContain(
      marker
    )
  }
}

test.describe('admin gate rejects unauthorized requests', () => {
  // Drop the stored admin session for this group only.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('an anonymous visitor is redirected away from every admin screen', async ({
    page,
  }) => {
    for (const route of ['/admin', '/admin/products', '/admin/users']) {
      await page.goto(route, { waitUntil: 'load' })
      await expect(
        page,
        `${route} must redirect an anonymous visitor to sign-in`
      ).toHaveURL(/\/auth\/signin/)
      await expectNoAdminShell(page)
    }
  })

  test('an anonymous visitor gets 401 from admin APIs, never a cached payload', async ({
    request,
  }) => {
    for (const endpoint of [
      '/api/admin/products',
      '/api/admin/orders',
      '/api/admin/users',
    ]) {
      const response = await request.get(endpoint)
      expect(
        response.status(),
        `${endpoint} must refuse an unauthenticated request`
      ).toBe(401)
      expect(await response.text()).not.toContain('"products"')
    }
  })

  test('a signed-in non-staff user is refused the admin surface', async ({
    page,
    request,
  }) => {
    test.skip(
      !CUSTOMER_EMAIL || !CUSTOMER_PASS,
      'set PLAYWRIGHT_CUSTOMER_EMAIL and PLAYWRIGHT_CUSTOMER_PASS to run the non-staff role check'
    )

    await page.goto('/auth/signin')
    await page.waitForSelector('input[name="identifier"]')
    await page.fill('input[name="identifier"]', CUSTOMER_EMAIL!)
    await page.fill(
      'input[type="password"], input[name="password"]',
      CUSTOMER_PASS!
    )
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes('/auth/signin'))

    await page.goto('/admin', { waitUntil: 'load' })
    await expect(
      page,
      'a non-staff role must be redirected off /admin'
    ).not.toHaveURL(/\/admin/)
    await expectNoAdminShell(page)

    const response = await request.get('/api/admin/products')
    expect(
      response.status(),
      'a non-staff role must be refused by the admin API'
    ).toBe(403)
  })
})

// ─── Admin Orders – Status Change Confirmation ────────────────────────────────

test.describe('Admin Orders - status change confirmation', () => {
  test('shows confirm dialog when status is changed via row expansion', async ({
    page,
  }, testInfo) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/orders')
    await expect(
      page.getByRole('heading', {
        name: /order management/i,
      })
    ).toBeVisible()

    if (!testInfo.project.name.includes('mobile')) {
      await page.getByText(MOCK_ORDERS[0].customerName).first().click()
    }

    const statusSelect = page
      .locator('select[aria-label^="Change status for order"]:visible')
      .first()
    await statusSelect.selectOption({ label: 'PROCESSING' })

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Change Order Status')).toBeVisible()
    await page.screenshot({
      path: screenshotPath('admin-order-status-confirm-dialog'),
      fullPage: false,
    })
  })

  test('cancels status change when Cancel is clicked in dialog', async ({
    page,
  }, testInfo) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/orders')
    await expect(
      page.getByRole('heading', {
        name: /order management/i,
      })
    ).toBeVisible()

    if (!testInfo.project.name.includes('mobile')) {
      await page.getByText(MOCK_ORDERS[0].customerName).first().click()
    }

    const statusSelect = page
      .locator('select[aria-label^="Change status for order"]:visible')
      .first()
    const originalStatus = await statusSelect.inputValue()
    await statusSelect.selectOption({ index: 1 })

    await expect(page.getByRole('dialog')).toBeVisible()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^cancel$/i })
      .click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(statusSelect).toHaveValue(originalStatus)
    await page.screenshot({
      path: screenshotPath('admin-order-status-cancelled'),
      fullPage: false,
    })
  })
})

// ─── Admin Users – Role Change Confirmation ────────────────────────────────────

test.describe('Admin Users - role change confirmation', () => {
  test('shows confirm dialog when role is changed', async ({ page }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/users')
    await expect(page.getByText('User Management')).toBeVisible()

    // Find a CUSTOMER role select (the second user in MOCK_USERS is a CUSTOMER)
    // and switch to ADMIN. Use .nth(1) to skip the first row (which is already ADMIN).
    const roleSelect = page.getByLabel(/change role for/i).nth(1)
    await roleSelect.selectOption('ADMIN')

    // Confirm dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Change User Role')).toBeVisible()
    await page.screenshot({
      path: screenshotPath('admin-user-role-confirm-dialog'),
      fullPage: false,
    })
  })

  test('cancels role change when Cancel is clicked in dialog', async ({
    page,
  }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/users')
    await expect(page.getByText('User Management')).toBeVisible()

    // Use the second user (a CUSTOMER) to avoid hitting the "can't change own role" guard
    const roleSelect = page.getByLabel(/change role for/i).nth(1)
    const originalRole = await roleSelect.inputValue()
    const newRole = originalRole === 'CUSTOMER' ? 'ADMIN' : 'CUSTOMER'
    await roleSelect.selectOption(newRole)

    await expect(page.getByRole('dialog')).toBeVisible()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^cancel$/i })
      .click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(roleSelect).toHaveValue(originalRole)
    await page.screenshot({
      path: screenshotPath('admin-user-role-cancelled'),
      fullPage: false,
    })
  })

  // T060: self-demotion and last-administrator-removal are refused by the
  // API (see src/app/api/admin/users/[id]/route.ts, FR-C04/FR-C05). These
  // tests mock the PATCH endpoint to return the same 403 responses the real
  // API returns for those two guards, and confirm the admin console leaves
  // the displayed role unchanged (the list is only refreshed on success —
  // see handleRoleChange in src/app/admin/users/page.tsx) rather than
  // silently applying a change the server refused.
  test('refuses self-demotion and leaves the role unchanged', async ({
    page,
  }) => {
    await mockAdminRoutes(page)
    // The signed-in test account is MOCK_USERS[0] (dev-copilot-admin).
    // Overriding this pattern after mockAdminRoutes means it is matched
    // first (Playwright resolves overlapping routes most-recently-added
    // first).
    await page.route('**/api/admin/users/dev-copilot-admin', (route) => {
      if (route.request().method() !== 'PATCH') {
        return route.fallback()
      }
      return route.fulfill({
        status: 403,
        json: { success: false, error: 'Cannot modify your own role' },
      })
    })
    await page.goto('/admin/users')
    await expect(page.getByText('User Management')).toBeVisible()

    const selfRoleSelect = page.getByLabel(/change role for/i).first()
    await expect(selfRoleSelect).toHaveValue('ADMIN')
    await selfRoleSelect.selectOption('CUSTOMER')

    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('textbox').fill('CHANGE ROLE')
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // The server refused the change, so the list was never refreshed and
    // the select must still reflect the original ADMIN role.
    await expect(selfRoleSelect).toHaveValue('ADMIN')
    await page.screenshot({
      path: screenshotPath('admin-user-self-demotion-refused'),
      fullPage: false,
    })
  })

  test('refuses removing the last administrator and leaves the role unchanged', async ({
    page,
  }) => {
    await mockAdminRoutes(page)
    // Simulate a second administrator distinct from the signed-in user
    // (usr0001) so the last-administrator guard can be exercised on a
    // non-self row without also tripping the self-demotion guard.
    await page.route('**/api/admin/users**', (route) => {
      const url = route.request().url()
      if (ADMIN_USER_DETAIL_PATTERN.test(url)) {
        return route.fulfill({
          json: { success: true, data: { user: MOCK_USERS[0] } },
        })
      }
      const usersWithSecondAdmin = MOCK_USERS.map((user) =>
        user.id === 'usr0001' ? { ...user, role: 'ADMIN' } : user
      )
      return route.fulfill({
        json: { success: true, data: { users: usersWithSecondAdmin } },
      })
    })
    await page.route('**/api/admin/users/usr0001', (route) => {
      if (route.request().method() !== 'PATCH') {
        return route.fallback()
      }
      return route.fulfill({
        status: 403,
        json: {
          success: false,
          error:
            'Cannot remove the last administrator. At least one user must hold the ADMIN role.',
        },
      })
    })
    await page.goto('/admin/users')
    await expect(page.getByText('User Management')).toBeVisible()

    const targetRoleSelect = page.getByLabel(/change role for priya sharma/i)
    await expect(targetRoleSelect).toHaveValue('ADMIN')
    await targetRoleSelect.selectOption('CUSTOMER')

    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('textbox').fill('CHANGE ROLE')
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    await expect(targetRoleSelect).toHaveValue('ADMIN')
    await page.screenshot({
      path: screenshotPath('admin-user-last-admin-removal-refused'),
      fullPage: false,
    })
  })
})

// T041: FULFILMENT-role scenario — dashboard queue → orders list → bulk action
test.describe('US1: Fulfilment staff clear the order queue', () => {
  test('T041 - bulk mark-shipped from dashboard queue link', async ({
    page,
  }) => {
    await page.goto('/admin')
    await page.screenshot({
      path: screenshotPath('admin-dashboard-queues'),
      fullPage: true,
    })

    const queueLink = page.getByRole('link', {
      name: /orders awaiting fulfilment/i,
    })
    if (await queueLink.isVisible()) {
      await queueLink.click()
      await page.waitForLoadState('networkidle')
    }

    await page.screenshot({
      path: screenshotPath('admin-orders-filtered-queue'),
      fullPage: true,
    })
  })
})

// T051: Activity panel visibility — global combined filtering plus per-entity
// panels mounted on order/product/user detail screens.
test.describe('US2: Activity visibility', () => {
  test('T051 - global activity page renders and filters by entity + action together', async ({
    page,
  }) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/activity')
    await page.waitForLoadState('networkidle')

    // Scope assertions to the rendered activity list (an <ol>) so they
    // don't accidentally match the same action names inside the (hidden)
    // "Action" <select> options.
    const activityList = page.getByRole('list')

    // Unfiltered: every mock entry's action text is present.
    await expect(activityList.getByText('status_change').first()).toBeVisible()
    await expect(activityList.getByText('refund').first()).toBeVisible()
    await expect(activityList.getByText('role_change').first()).toBeVisible()

    await page.screenshot({
      path: screenshotPath('admin-global-activity'),
      fullPage: true,
    })

    // Combined entity + action filter narrows to a single record.
    await page.getByLabel('Entity').selectOption('order')
    await page.getByLabel('Action').selectOption('status_change')
    await page.waitForLoadState('networkidle')

    await expect(activityList.getByText('status_change')).toBeVisible()
    await expect(activityList.getByText('refund')).toHaveCount(0)
    await expect(activityList.getByText('role_change')).toHaveCount(0)

    await page.screenshot({
      path: screenshotPath('admin-global-activity-filtered'),
      fullPage: true,
    })
  })

  test('T051 - order detail row expansion shows scoped activity history', async ({
    page,
  }, testInfo) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/orders')
    await expect(
      page.getByRole('heading', { name: /order management/i })
    ).toBeVisible()

    if (!testInfo.project.name.includes('mobile')) {
      // Two levels of expansion: the AdminDataView row itself, then the
      // AdminOrderCard's own internal "Show details" toggle that reveals
      // the EntityActivitySection.
      await page.getByText(MOCK_ORDERS[0].customerName).first().click()
    }
    await page
      .getByRole('button', { name: /show details/i })
      .first()
      .click()

    await expect(page.getByText('Activity History')).toBeVisible()
    await expect(page.getByText('After: SHIPPED')).toBeVisible()
    await page.screenshot({
      path: screenshotPath('admin-order-activity-history'),
      fullPage: true,
    })
  })

  test('T051 - product detail screen shows scoped activity history', async ({
    page,
  }) => {
    // The product detail screen is a Server Component that reads the
    // product directly from the database (bypassing route mocking), so we
    // let the products list hit the real backend and navigate to whichever
    // product actually exists there instead of a fixed mock id. Only the
    // Activity Log API (an independent client-side fetch made by
    // EntityActivitySection) is mocked, so the assertion stays deterministic.
    await page.route('**/api/admin/activity**', (route) => {
      const url = new URL(route.request().url())
      const entity = url.searchParams.get('entity')
      const entries = MOCK_ACTIVITY_ENTRIES.filter(
        (entry) => !entity || entry.entity === entity
      )
      return route.fulfill({
        json: {
          success: true,
          data: { entries, nextCursor: null, retentionWindowMonths: 24 },
        },
      })
    })
    await page.goto('/admin/products')
    await expect(
      page.getByRole('heading', { name: /product management/i })
    ).toBeVisible()
    await page.getByRole('link', { name: /^open/i }).first().click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Activity History')).toBeVisible()
    await page.screenshot({
      path: screenshotPath('admin-product-activity-history'),
      fullPage: true,
    })
  })

  test('T051 - user row expansion shows scoped activity history', async ({
    page,
  }, testInfo) => {
    await mockAdminRoutes(page)
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    if (!testInfo.project.name.includes('mobile')) {
      // Click on the row's unique email text (the user's name also appears
      // in the header "Copilot Admin" badge, which would match first()).
      await page.getByText(MOCK_USERS[0].email).first().click()
    }

    await expect(page.getByText('Activity History').first()).toBeVisible()
    await page.screenshot({
      path: screenshotPath('admin-user-activity-history'),
      fullPage: true,
    })
  })
})

// T059: Form consistency
test.describe('US3: Form consistency', () => {
  test('T059 - categories and coupons form screens', async ({ page }) => {
    await page.goto('/admin/categories')
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: screenshotPath('admin-categories-form'),
      fullPage: true,
    })

    await page.goto('/admin/coupons')
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: screenshotPath('admin-coupons-form'),
      fullPage: true,
    })
  })
})

// T075: Converted screens
test.describe('US4: Screen conversions', () => {
  const screens = [
    { name: 'users', path: '/admin/users' },
    { name: 'products', path: '/admin/products' },
    { name: 'reviews', path: '/admin/reviews' },
    { name: 'returns', path: '/admin/returns' },
    { name: 'checkout-requests', path: '/admin/checkout-requests' },
    { name: 'recommendations', path: '/admin/recommendations' },
    { name: 'email-failures', path: '/admin/email-failures' },
    { name: 'search', path: '/admin/search' },
  ]

  for (const screen of screens) {
    test(`T075 - ${screen.name} screen renders`, async ({ page }) => {
      await page.goto(screen.path)
      await page.waitForLoadState('networkidle')
      await page.screenshot({
        path: screenshotPath(`admin-${screen.name}-converted`),
        fullPage: true,
      })
    })
  }
})

// T077: Retired route redirects
test.describe('Redirect map', () => {
  test('T077 - /admin/sales redirects to /admin', async ({ page }) => {
    await page.goto('/admin/sales')
    expect(page.url()).toContain('/admin')
    await page.screenshot({
      path: screenshotPath('admin-sales-redirect'),
      fullPage: false,
    })
  })
})
