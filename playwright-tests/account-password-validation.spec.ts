/**
 * Account page – confirm new password field validation tests.
 *
 * Runs as the Copilot admin account (storageState from global-setup).
 * The /api/account endpoint is mocked so that hasPassword: true is returned,
 * making the Change Password section visible regardless of the real DB state.
 *
 * Covers:
 * - No "Passwords don't match" shown while typing (before blur)
 * - Error appears after blurring when passwords differ
 * - Error disappears when passwords match after blur
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

function screenshotPath(name: string) {
  return path.join(SCREENSHOT_DIR, `${name}.png`);
}

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

const MOCK_PROFILE = {
  id: 'usr0001',
  name: 'Copilot Admin',
  email: 'copilot-admin@example.com',
  phoneNumber: null,
  image: null,
  role: 'ADMIN',
  hasPassword: true,
  createdAt: new Date().toISOString(),
};

async function goToAccountWithPassword(page: import('@playwright/test').Page) {
  // Mock /api/account so hasPassword: true, which shows the Change Password section
  await page.route('**/api/account**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: { success: true, data: MOCK_PROFILE },
      });
    }
    return route.continue();
  });
  await page.goto('/account');
  // Wait for the Change Password heading to appear
  await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible();
}

test.describe('Account page - confirm new password validation', () => {
  test('no error shown while typing in confirm password field before blur', async ({ page }) => {
    await goToAccountWithPassword(page);

    await page.locator('#confirm-new-password').fill('Different');

    // Error must NOT appear while the field is still focused (not blurred)
    await expect(page.getByText("Passwords don't match")).not.toBeVisible();

    await page.screenshot({ path: screenshotPath('account-no-error-while-typing') });
  });

  test('error shown after blurring confirm new password when passwords do not match', async ({ page }) => {
    await goToAccountWithPassword(page);

    await page.locator('#new-password').fill('MyPassword1!');
    await page.locator('#confirm-new-password').fill('WrongPassword');
    await page.locator('#confirm-new-password').blur();

    await expect(page.getByText("Passwords don't match")).toBeVisible();

    await page.screenshot({ path: screenshotPath('account-error-after-blur') });
  });

  test('error disappears when confirm new password is corrected to match', async ({ page }) => {
    await goToAccountWithPassword(page);

    await page.locator('#new-password').fill('MyPassword1!');
    await page.locator('#confirm-new-password').fill('WrongPassword');
    await page.locator('#confirm-new-password').blur();

    await expect(page.getByText("Passwords don't match")).toBeVisible();

    // Fix the value to match
    await page.locator('#confirm-new-password').fill('MyPassword1!');

    await expect(page.getByText("Passwords don't match")).not.toBeVisible();

    await page.screenshot({ path: screenshotPath('account-error-gone-when-match') });
  });

  test('no error when confirm new password is empty after blur', async ({ page }) => {
    await goToAccountWithPassword(page);

    const confirmInput = page.locator('#confirm-new-password');
    await confirmInput.focus();
    await confirmInput.blur();

    await expect(page.getByText("Passwords don't match")).not.toBeVisible();
  });
});
