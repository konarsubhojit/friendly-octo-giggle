/**
 * Accessibility tests using axe-core (WCAG 2.1 AA).
 *
 * Two test groups:
 *  - Public pages  — no authentication required
 *  - Authenticated pages — requires admin session (storageState)
 *
 * Each test injects axe into the page, runs an audit, and asserts zero violations.
 * Violations are printed to the console so CI logs are actionable.
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format axe violations into a readable summary for assertion messages.
 */
const formatViolations = (
  violations: Array<{
    id: string
    description: string
    impact?: string | null
    nodes: Array<{ html: string }>
  }>
) =>
  violations
    .map(
      (v) =>
        `[${v.impact?.toUpperCase() ?? 'UNKNOWN'}] ${v.id}: ${v.description}\n` +
        v.nodes
          .slice(0, 3)
          .map((n) => `  - ${n.html}`)
          .join('\n')
    )
    .join('\n\n')

const navigateToFirstProduct = async (
  page: import('@playwright/test').Page
): Promise<void> => {
  await page.goto('/shop')
  await page.waitForLoadState('networkidle')
  const firstProductLink = page.locator('a[href^="/products/"]').first()
  await expect(firstProductLink).toBeVisible()
  await firstProductLink.click()
  await page.waitForLoadState('networkidle')
}

// ─── Public pages (unauthenticated) ──────────────────────────────────────────

test.describe('Accessibility – public pages', () => {
  const publicRoutes: Array<{
    name: string
    path?: string
    navigate?: (page: import('@playwright/test').Page) => Promise<void>
  }> = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: 'Product', navigate: navigateToFirstProduct },
    { name: 'About', path: '/about' },
    { name: 'Blog', path: '/blog' },
    { name: 'Careers', path: '/careers' },
    { name: 'Contact', path: '/contact' },
    { name: 'Help', path: '/help' },
    { name: 'Press', path: '/press' },
    { name: 'Returns', path: '/returns' },
    { name: 'Shipping', path: '/shipping' },
    { name: 'Sign In', path: '/auth/signin' },
    { name: 'Register', path: '/auth/register' },
    { name: 'Cart', path: '/cart' },
    { name: 'Checkout Shipping', path: '/checkout/shipping' },
    { name: 'Checkout Review', path: '/checkout/review' },
  ]

  for (const route of publicRoutes) {
    test(`${route.name} page has no WCAG 2.1 AA violations`, async ({
      page,
    }) => {
      if (route.navigate) {
        await route.navigate(page)
      } else if (route.path) {
        await page.goto(route.path)
        await page.waitForLoadState('networkidle')
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const violations = results.violations
      if (violations.length > 0) {
        process.stderr.write(
          `\n❌ ${route.name} (${route.path ?? 'dynamic'}) — ${violations.length} violation(s):\n${formatViolations(violations)}\n`
        )
      }

      expect(
        violations,
        `${route.name}: axe violations found:\n${formatViolations(violations)}`
      ).toHaveLength(0)
    })
  }
})

// ─── Authenticated pages (admin session) ─────────────────────────────────────

test.describe('Accessibility – authenticated pages', () => {
  const authenticatedRoutes: Array<{ name: string; path: string }> = [
    { name: 'Account', path: '/account' },
    { name: 'Orders', path: '/orders' },
    { name: 'Checkout Shipping', path: '/checkout/shipping' },
    { name: 'Checkout Review', path: '/checkout/review' },
    { name: 'Admin Dashboard', path: '/admin' },
    { name: 'Admin Products', path: '/admin/products' },
    { name: 'Admin Orders', path: '/admin/orders' },
    { name: 'Admin Users', path: '/admin/users' },
  ]

  for (const route of authenticatedRoutes) {
    test(`${route.name} page has no WCAG 2.1 AA violations`, async ({
      page,
    }) => {
      await page.goto(route.path)
      await page.waitForLoadState('networkidle')

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const violations = results.violations
      if (violations.length > 0) {
        process.stderr.write(
          `\n❌ ${route.name} (${route.path}) — ${violations.length} violation(s):\n${formatViolations(violations)}\n`
        )
      }

      expect(
        violations,
        `${route.name}: axe violations found:\n${formatViolations(violations)}`
      ).toHaveLength(0)
    })
  }
})
