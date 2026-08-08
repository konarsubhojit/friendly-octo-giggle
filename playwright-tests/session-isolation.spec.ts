/**
 * Session isolation under Cache Components (SC-005, FR-008).
 *
 * The migration to `cacheComponents: true` moves every route onto a
 * prerendered shell plus streamed dynamic holes. The failure mode that
 * introduces is a personalized response leaking into a cached shell and being
 * served to a different visitor. These tests exercise exactly that window:
 * an authenticated session requests a personalized route first (warming any
 * cache entry the route can produce), and a concurrent session that is *not*
 * that user then requests the same URL and must never see the first user's
 * data.
 *
 * The always-on comparison is authenticated-vs-anonymous, because it needs no
 * second credential set. When a second account is configured via
 * `PLAYWRIGHT_SECOND_EMAIL` / `PLAYWRIGHT_SECOND_PASS`, the stronger
 * user-A-vs-user-B comparison runs as well.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { AUTH_STATE_PATH } from './global-setup'

const PERSONALIZED_ROUTES = ['/cart', '/orders', '/account', '/admin'] as const

const SECOND_EMAIL = process.env.PLAYWRIGHT_SECOND_EMAIL
const SECOND_PASS = process.env.PLAYWRIGHT_SECOND_PASS

/** Read the signed-in identity a context is carrying, if any. */
const getSessionIdentity = async (
  context: BrowserContext
): Promise<{ id?: string; email?: string } | null> => {
  const response = await context.request.get('/api/auth/session')
  if (!response.ok()) return null
  const session = (await response.json()) as {
    user?: { id?: string; email?: string }
  }
  return session.user ?? null
}

/** Sign a fresh context in with credentials, returning its page. */
const signIn = async (
  context: BrowserContext,
  email: string,
  password: string
): Promise<Page> => {
  const page = await context.newPage()
  await page.goto('/auth/signin')
  await page.waitForSelector('input[name="identifier"]')
  await page.fill('input[name="identifier"]', email)
  await page.fill('input[type="password"], input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/auth/signin'))
  return page
}

/**
 * Assert that `page` — belonging to a different visitor — never renders the
 * identity markers of the session that warmed the route.
 */
const expectNoLeakedIdentity = async (
  page: Page,
  route: string,
  markers: readonly string[]
) => {
  const response = await page.goto(route, { waitUntil: 'load' })
  expect(response, `expected a response for ${route}`).not.toBeNull()
  expect(
    response!.status(),
    `${route} responded with ${response!.status()}`
  ).toBeLessThan(500)

  const html = await page.content()
  for (const marker of markers) {
    expect(
      html,
      `${route} leaked "${marker}" to a different session`
    ).not.toContain(marker)
  }
}

test.describe('session isolation across concurrent sessions', () => {
  test('an anonymous visitor never receives the signed-in user data', async ({
    browser,
  }) => {
    const authed = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      ignoreHTTPSErrors: true,
    })
    const anonymous = await browser.newContext({ ignoreHTTPSErrors: true })

    try {
      const identity = await getSessionIdentity(authed)
      expect(
        identity?.email,
        'the stored auth state must carry a signed-in session'
      ).toBeTruthy()
      expect(
        await getSessionIdentity(anonymous),
        'the second context must be anonymous'
      ).toBeNull()

      const markers = [identity!.email!, identity!.id].filter(
        (value): value is string => Boolean(value)
      )

      const authedPage = await authed.newPage()
      const anonymousPage = await anonymous.newPage()

      for (const route of PERSONALIZED_ROUTES) {
        // Warm first as the signed-in user, then read as a stranger.
        await authedPage.goto(route, { waitUntil: 'load' })
        await expectNoLeakedIdentity(anonymousPage, route, markers)
      }

      // The proxy gate must still reject an unauthenticated /admin request
      // rather than serving a cached admin shell.
      await anonymousPage.goto('/admin', { waitUntil: 'load' })
      await expect(
        anonymousPage,
        '/admin must not render for an anonymous visitor'
      ).toHaveURL(/\/auth\/signin/)
    } finally {
      await authed.close()
      await anonymous.close()
    }
  })

  test('a second signed-in user never receives the first user data', async ({
    browser,
  }) => {
    test.skip(
      !SECOND_EMAIL || !SECOND_PASS,
      'set PLAYWRIGHT_SECOND_EMAIL and PLAYWRIGHT_SECOND_PASS to run the two-user comparison'
    )

    const first = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      ignoreHTTPSErrors: true,
    })
    const second = await browser.newContext({ ignoreHTTPSErrors: true })

    try {
      const firstIdentity = await getSessionIdentity(first)
      expect(firstIdentity?.email).toBeTruthy()

      const secondPage = await signIn(second, SECOND_EMAIL!, SECOND_PASS!)
      const secondIdentity = await getSessionIdentity(second)
      expect(secondIdentity?.email).toBeTruthy()
      expect(
        secondIdentity!.email,
        'the two sessions must be different users'
      ).not.toBe(firstIdentity!.email)

      const markers = [firstIdentity!.email!, firstIdentity!.id].filter(
        (value): value is string => Boolean(value)
      )

      const firstPage = await first.newPage()
      for (const route of PERSONALIZED_ROUTES) {
        await firstPage.goto(route, { waitUntil: 'load' })
        await expectNoLeakedIdentity(secondPage, route, markers)
      }
    } finally {
      await first.close()
      await second.close()
    }
  })
})
