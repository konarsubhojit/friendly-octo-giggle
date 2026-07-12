import { expect, test } from '@playwright/test'

test.describe('latest platform capabilities', () => {
  test('web app manifest exposes install metadata and shortcuts', async ({
    request,
  }) => {
    const response = await request.get('/manifest.webmanifest')
    expect(response.ok()).toBe(true)

    const manifest = (await response.json()) as {
      name: string
      display: string
      icons: Array<{ sizes: string; purpose?: string }>
      shortcuts: Array<{ name: string; url: string }>
      screenshots: Array<{ form_factor?: string }>
    }

    expect(manifest.name).toBe('The Kiyon Store')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
      ])
    )
    expect(manifest.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Shop', url: '/shop' }),
        expect.objectContaining({ name: 'Cart', url: '/cart' }),
      ])
    )
    expect(manifest.screenshots).toContainEqual(
      expect.objectContaining({ form_factor: 'narrow' })
    )
  })

  test('localized offline fallback offers recovery actions', async ({ page }) => {
    const response = await page.goto('/en/offline', {
      waitUntil: 'domcontentloaded',
    })

    expect(response?.status()).toBeLessThan(400)
    await expect(
      page.getByRole('heading', { name: /you.re offline/i })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /go home/i })).toHaveAttribute(
      'href',
      '/en'
    )
  })

  test('language preference switches to the equivalent Spanish route', async ({
    page,
  }) => {
    await page.route('**/api/account', (route) =>
      route.fulfill({ status: 200, json: { success: true } })
    )
    await page.goto('/en/about', { waitUntil: 'domcontentloaded' })

    const language = page.getByRole('combobox', { name: 'Language' })
    await expect(language).toHaveValue('en')
    await expect(language.locator('option')).toHaveText(['English', 'Español'])
    await language.selectOption('es')

    await expect(page).toHaveURL(/\/es\/about$/)
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue(
      'es'
    )
  })

  test('header search renders grouped accessible suggestions', async ({
    page,
  }) => {
    await page.route('**/api/search/suggest?**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            query: 'rose',
            products: [
              { id: 'prd0001', label: 'Rose Keyring', category: 'Accessories' },
            ],
            categories: ['Flowers'],
            popular: ['flower bouquet'],
          },
        },
      })
    )
    await page.goto('/en', { waitUntil: 'domcontentloaded' })

    const search = page.getByRole('combobox', { name: 'Search products' }).first()
    await search.fill('rose')

    const suggestions = page.getByRole('listbox', {
      name: 'Search suggestions',
    })
    await expect(suggestions).toBeVisible()
    await expect(suggestions.getByRole('option')).toHaveCount(3)
    await expect(suggestions).toContainText('Rose Keyring')
    await expect(suggestions).toContainText('Flowers')
    await expect(suggestions).toContainText('flower bouquet')
  })

  test('admin search page reports product and order index readiness', async ({
    page,
  }) => {
    const response = await page.goto('/en/admin/search', {
      waitUntil: 'domcontentloaded',
    })

    expect(response?.status()).toBeLessThan(400)
    await expect(
      page.getByRole('heading', { name: 'Search Index Management' })
    ).toBeVisible()
    await expect(page.getByText('Products index')).toBeVisible()
    await expect(page.getByText('Orders index')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reindex' })).toBeVisible()
  })
})
