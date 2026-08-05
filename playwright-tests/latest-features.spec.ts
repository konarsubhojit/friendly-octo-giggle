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
        expect.objectContaining({ name: 'Shop', url: '/' }),
        expect.objectContaining({ name: 'Cart', url: '/cart' }),
      ])
    )
    expect(manifest.screenshots).toContainEqual(
      expect.objectContaining({ form_factor: 'narrow' })
    )
  })

  test('offline fallback offers recovery actions', async ({ page }) => {
    const response = await page.goto('/offline', {
      waitUntil: 'domcontentloaded',
    })

    expect(response?.status()).toBeLessThan(400)
    await expect(
      page.getByRole('heading', { name: /you.re offline/i })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /go home/i })).toHaveAttribute(
      'href',
      '/'
    )
  })

  test('header search renders grouped accessible suggestions', async ({
    page,
  }) => {
    await page.route('**/api/search?**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            results: [
              {
                id: 'prd0001',
                name: 'Rose Keyring',
                description: 'Handmade flower keyring',
                price: 12,
                image: '',
                category: 'Accessories',
              },
            ],
          },
        },
      })
    )
    await page.goto('/', { waitUntil: 'networkidle' })

    await page.getByRole('button', { name: 'Search products' }).click()
    const dialog = page.getByRole('dialog', { name: 'Search products' })
    await dialog
      .getByRole('searchbox', { name: 'Search products' })
      .fill('rose')

    await expect(dialog.getByText('Rose Keyring')).toBeVisible()
    await expect(dialog.getByText('Accessories')).toBeVisible()
  })

  test('admin search-index operations require authentication', async ({
    page,
  }) => {
    await page.goto('/admin/search', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/auth\/signin/)
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible()
  })
})
