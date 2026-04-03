import { test, expect, type Page } from '@playwright/test'
import { join, dirname } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SCREENSHOT_DIR = join(__dirname, 'screenshots', 'ux-audit')

const PUBLIC_PROJECTS = new Set(['desktop-chrome', 'mobile-chrome'])
const ADMIN_PROJECTS = new Set(['admin-desktop', 'admin-mobile'])

const PUBLIC_ROUTES = [
  { slug: 'home', path: '/' },
  { slug: 'shop', path: '/shop' },
  { slug: 'about', path: '/about' },
  { slug: 'contact', path: '/contact' },
  { slug: 'shipping', path: '/shipping' },
  { slug: 'signin', path: '/auth/signin' },
  { slug: 'register', path: '/auth/register' },
] as const

const ADMIN_ROUTES = [
  { slug: 'dashboard', path: '/admin' },
  { slug: 'products', path: '/admin/products' },
  { slug: 'orders', path: '/admin/orders' },
  { slug: 'users', path: '/admin/users' },
  { slug: 'reviews', path: '/admin/reviews' },
  { slug: 'search', path: '/admin/search' },
  { slug: 'email-failures', path: '/admin/email-failures' },
] as const

test.beforeAll(() => {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
})

async function settlePage() {
  await test.step('allow UI to settle', async () => {
    await new Promise((resolve) => setTimeout(resolve, 600))
  })
}

async function auditViewport(page: Page) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const interactiveSelectors = [
      'button',
      'a',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="menuitem"]',
    ].join(',')

    const isVisible = (element: Element) => {
      const style = globalThis.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      )
    }

    const isInsideHorizontalScrollRegion = (element: Element) => {
      let current: Element | null = element.parentElement
      while (current) {
        const style = globalThis.getComputedStyle(current)
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
          return true
        }
        current = current.parentElement
      }
      return false
    }

    const interactiveOffenders = Array.from(
      document.querySelectorAll(interactiveSelectors)
    )
      .filter(isVisible)
      .filter((element) => !isInsideHorizontalScrollRegion(element))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          label:
            element.getAttribute('aria-label') ||
            element.textContent?.trim().replaceAll(/\s+/g, ' ').slice(0, 80) ||
            element.tagName.toLowerCase(),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })
      .filter((item) => item.left < -1 || item.right > viewportWidth + 1)
      .slice(0, 12)

    return {
      clientWidth: viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      interactiveOffenders,
    }
  })

  expect(
    result.scrollWidth,
    `Expected no page-level horizontal overflow: ${JSON.stringify(result.interactiveOffenders)}`
  ).toBeLessThanOrEqual(result.clientWidth + 1)
  expect(result.interactiveOffenders).toEqual([])
}

async function capture(page: Page, name: string) {
  await page.screenshot({
    path: join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  })
}

test.describe('public route UX audit', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.slug} layout stays inside the viewport`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !PUBLIC_PROJECTS.has(testInfo.project.name),
        'Public route audit only runs on public desktop/mobile projects.'
      )

      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await settlePage()
      await auditViewport(page)
      await capture(page, `${testInfo.project.name}-${route.slug}`)
    })
  }

  test('first product detail layout stays inside the viewport', async ({
    page,
  }, testInfo) => {
    test.skip(
      !PUBLIC_PROJECTS.has(testInfo.project.name),
      'Public route audit only runs on public desktop/mobile projects.'
    )

    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    await page
      .locator('a[href^="/products/"]')
      .first()
      .waitFor({ state: 'visible' })
    const firstProductHref = await page
      .locator('a[href^="/products/"]')
      .first()
      .getAttribute('href')

    if (!firstProductHref) {
      throw new Error(
        'Expected the shop page to expose at least one product detail link.'
      )
    }

    await page.goto(firstProductHref, { waitUntil: 'domcontentloaded' })
    await settlePage()
    await auditViewport(page)
    await capture(page, `${testInfo.project.name}-product-detail`)
  })
})

test.describe('admin route UX audit', () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route.slug} admin layout stays inside the viewport`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !ADMIN_PROJECTS.has(testInfo.project.name),
        'Admin route audit only runs on admin desktop/mobile projects.'
      )

      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await settlePage()
      await auditViewport(page)
      await capture(page, `${testInfo.project.name}-${route.slug}`)
    })
  }
})

test.describe('validation UX audit', () => {
  test('sign-in form shows the improved inline guidance', async ({
    page,
  }, testInfo) => {
    test.skip(
      !PUBLIC_PROJECTS.has(testInfo.project.name),
      'Validation audit only runs on public desktop/mobile projects.'
    )

    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' })
    await settlePage()
    await page.locator('#signin-identifier').fill('x')
    await page.locator('#signin-identifier').clear()
    await page.locator('#signin-password').fill('x')
    await page.locator('#signin-password').clear()
    await page
      .locator('main form')
      .getByRole('button', { name: /^login$/i })
      .click()

    await expect(page.locator('form [role="alert"]').first()).toContainText(
      'Please correct'
    )
    await expect(
      page.getByText(
        'Enter the email address or phone number linked to your account.'
      )
    ).toBeVisible()
    await expect(
      page.getByText('Enter your password to continue.')
    ).toBeVisible()
  })

  test('register form shows the stronger mismatch message after blur', async ({
    page,
  }, testInfo) => {
    test.skip(
      !PUBLIC_PROJECTS.has(testInfo.project.name),
      'Validation audit only runs on public desktop/mobile projects.'
    )

    await page.goto('/auth/register', { waitUntil: 'domcontentloaded' })
    await settlePage()
    await page.locator('#register-name').fill('Test User')
    await page.locator('#register-email').fill('test@example.com')
    await page.locator('#register-password').fill('MyPassword1!')
    await page.locator('#register-confirm-password').fill('WrongPassword1!')
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page.locator('form [role="alert"]').first()).toContainText(
      'Please correct'
    )
    await expect(page.locator('#register-confirm-password')).toHaveClass(
      /border-red-400/
    )
  })

  test('contact form uses more actionable validation copy', async ({
    page,
  }, testInfo) => {
    test.skip(
      !PUBLIC_PROJECTS.has(testInfo.project.name),
      'Validation audit only runs on public desktop/mobile projects.'
    )

    await page.goto('/contact', { waitUntil: 'domcontentloaded' })
    await settlePage()
    await page.getByRole('button', { name: /send message/i }).click()

    await expect(page.locator('form [role="alert"]').first()).toContainText(
      'Please correct'
    )
    await expect(
      page.getByText('Tell us your name so we know how to address you.')
    ).toBeVisible()
    await expect(
      page.getByText('Enter the email address where we should reply.')
    ).toBeVisible()
  })
})
