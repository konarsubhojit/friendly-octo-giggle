import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_ORDERS } from './mock-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

test.use({ storageState: './playwright-tests/.auth/admin.json' });

function screenshotPath(name: string) {
  return path.join(SCREENSHOT_DIR, `${name}.png`);
}

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

async function mockSharedOrderRoutes(page: Page) {
  await page.route('**/api/orders**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          orders: MOCK_ORDERS,
          hasMore: false,
          totalCount: MOCK_ORDERS.length,
          nextCursor: null,
        },
      },
    }),
  );

  await page.route('**/api/admin/orders**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          orders: MOCK_ORDERS,
          hasMore: false,
          totalCount: MOCK_ORDERS.length,
          nextCursor: null,
        },
      },
    }),
  );

  await page.route('**/api/exchange-rates**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 } },
      },
    }),
  );
}

test.describe('Orders List Summary', () => {
  test('my orders shows compact product summaries over pricing', async ({
    page,
  }) => {
    await mockSharedOrderRoutes(page);
    await page.goto('/orders');

    await expect(page.getByRole('heading', { name: /my orders/i })).toBeVisible();
    await expect(
      page.getByText('Hand-knitted Flower Bouquet, Cozy Wool Muffler'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Open the order to review pricing, shipping address, and full item details.',
      ).first(),
    ).toBeVisible();

    await page.screenshot({
      path: screenshotPath('my-orders-summary'),
      fullPage: true,
    });
  });

  test('account overview shows recent orders with compact summaries', async ({
    page,
  }) => {
    await mockSharedOrderRoutes(page);
    await page.route('**/api/account', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            id: 'user-1',
            name: 'Priya Sharma',
            email: 'priya.sharma@example.com',
            phoneNumber: '+919876543210',
            image: null,
            role: 'CUSTOMER',
            hasPassword: true,
            currencyPreference: 'INR',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        },
      }),
    );
    await page.goto('/account');

    await expect(
      page.getByRole('heading', { name: /recent orders/i }),
    ).toBeVisible();
    await expect(
      page.getByText('Hand-knitted Flower Bouquet, Cozy Wool Muffler'),
    ).toBeVisible();

    await page.screenshot({
      path: screenshotPath('account-recent-orders-summary'),
      fullPage: true,
    });
  });

  test('admin orders keeps product summary and status controls together', async ({
    page,
  }) => {
    await mockSharedOrderRoutes(page);
    await page.goto('/admin/orders');

    await expect(
      page.getByRole('heading', {
        name: /orders workspace tuned for faster exception handling/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText('Hand-knitted Flower Bouquet, Cozy Wool Muffler'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /show details/i }).first(),
    ).toBeVisible();
    await expect(page.getByText('Pricing in order details')).toHaveCount(0);
    await expect(
      page.getByLabel('Change status for order ord0001'),
    ).toBeVisible();

    await page.getByRole('button', { name: /show details/i }).first().click();
    await expect(page.getByText('Pricing in order details').first()).toBeVisible();

    await page.screenshot({
      path: screenshotPath('admin-orders-summary'),
      fullPage: true,
    });
  });
});