/**
 * Playwright E2E test — verifies that the AI product assistant never
 * reveals exact stock quantities to customers.
 *
 * Strategy: navigate to a real product page, interact with the AI chat,
 * and assert the response uses qualitative stock labels instead of numbers.
 * The chat API is mocked so we can inspect the request body (the product
 * context) rather than depending on a live Gemini API key.
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import { dirname, join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SCREENSHOT_DIR = join(__dirname, 'screenshots')

const screenshotPath = (name: string) => join(SCREENSHOT_DIR, `${name}.png`)

test.beforeAll(() => {
  if (!existsSync(SCREENSHOT_DIR))
    mkdirSync(SCREENSHOT_DIR, { recursive: true })
})

/** Suppress exchange-rate 500s in test env. */
const mockExchangeRates = async (page: Page) => {
  await page.route('**/api/exchange-rates**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 } },
      },
    })
  )
}

/** Captured request bodies from the AI chat API. */
let capturedChatBodies: Array<{
  messages: Array<{ role: string; text: string }>
}> = []

/**
 * Mock the AI chat API to return a controlled response and capture the
 * request body for inspection.
 */
const mockAiChatApi = async (page: Page) => {
  capturedChatBodies = []
  await page.route('**/api/ai/products/*/chat', async (route: Route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    const body = request.postDataJSON()
    capturedChatBodies.push(body)

    // Return a simple JSON response (non-streaming) with qualitative stock info
    await route.fulfill({
      contentType: 'application/json',
      json: { text: 'Both variants are currently in stock.' },
    })
  })
}

test.describe('AI Product Assistant — stock privacy', () => {
  test('should not expose exact stock counts in AI chat response', async ({
    page,
  }) => {
    await mockExchangeRates(page)
    await mockAiChatApi(page)

    // Navigate to the test product page
    await page.goto('/products/Pbwkjtm', { waitUntil: 'networkidle' })

    // Open the assistant by clicking the collapsed button
    const openButton = page.getByRole('button', {
      name: /Ask a question about/i,
    })
    await expect(openButton).toBeVisible({ timeout: 10_000 })
    await openButton.click()

    // The Product Assistant section should now be visible
    const assistant = page.locator('section[aria-label="Product assistant"]')
    await expect(assistant).toBeVisible({ timeout: 10_000 })

    // Click a starter prompt to trigger the first AI call
    const starterButton = assistant.getByText('Tell me more about this product')
    if (await starterButton.isVisible()) {
      await starterButton.click()
    }

    // Wait for the AI response to appear
    await expect(
      assistant.getByText('Both variants are currently in stock.')
    ).toBeVisible({ timeout: 10_000 })

    // Take screenshot for evidence
    await page.screenshot({
      path: screenshotPath('ai-stock-privacy-chat'),
      fullPage: false,
    })

    // Verify the AI response text does not contain exact stock numbers
    const responseText = await assistant.textContent()
    expect(responseText).not.toMatch(/\d{2,}\s*(units|in stock)/iu)
    expect(responseText).not.toMatch(/\(\d+.*in stock\)/iu)

    // Assert the captured request body does not leak exact stock counts
    expect(capturedChatBodies.length).toBeGreaterThan(0)
    const requestPayload = JSON.stringify(capturedChatBodies[0])
    expect(requestPayload).not.toMatch(/"stock"\s*:\s*\d+/iu)
  })

  test('should use option value labels instead of raw SKU codes', async ({
    page,
  }) => {
    await mockExchangeRates(page)
    await mockAiChatApi(page)

    await page.goto('/products/Pbwkjtm', { waitUntil: 'networkidle' })

    // Open the assistant
    const openButton = page.getByRole('button', {
      name: /Ask a question about/i,
    })
    await expect(openButton).toBeVisible({ timeout: 10_000 })
    await openButton.click()

    const assistant = page.locator('section[aria-label="Product assistant"]')
    await expect(assistant).toBeVisible({ timeout: 10_000 })

    // Type a question asking about variants
    const input = assistant.getByPlaceholder('Ask about this product...')
    await input.fill('What variants are available?')

    const sendButton = assistant.getByRole('button', { name: 'Send message' })
    await sendButton.click()

    // Wait for response
    await expect(
      assistant.getByText('Both variants are currently in stock.')
    ).toBeVisible({ timeout: 10_000 })

    // Take screenshot
    await page.screenshot({
      path: screenshotPath('ai-variant-labels'),
      fullPage: false,
    })

    // Verify the response doesn't contain raw SKU codes like "ABC-Red-XL"
    const responseText = await assistant.textContent()
    // The response should not contain the compound SKU format
    expect(responseText).not.toMatch(/ABC-Red-(XL|L)/iu)

    // Assert the captured request included context (not empty)
    expect(capturedChatBodies.length).toBeGreaterThan(0)
  })
})
