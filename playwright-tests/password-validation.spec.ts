/**
 * Password validation tests for registration and account pages.
 *
 * Covers the following scenarios:
 * - "Passwords don't match" message does NOT appear while typing (before blur)
 * - "Passwords don't match" message appears after the field is blurred when passwords differ
 * - Message disappears when passwords match after blur
 * - Only one error message shown at a time (no duplicates)
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

// ─── Register Page: Password Validation ──────────────────────────────────────

test.describe('Register page - password validation', () => {
  test('no error shown while typing in confirm password field before blur', async ({ page }) => {
    await page.goto('/auth/register');

    const passwordInput = page.locator('#register-password');
    const confirmInput = page.locator('#register-confirm-password');

    // Fill main password
    await passwordInput.fill('MyPassword1!');

    // Start typing a non-matching value in confirm field - do NOT blur
    await confirmInput.fill('Different');

    // Error must NOT appear while the field is still focused (not blurred)
    await expect(page.getByText("Passwords don't match")).not.toBeVisible();

    await page.screenshot({ path: screenshotPath('register-no-error-while-typing') });
  });

  test('error shown after blurring confirm password when passwords do not match', async ({ page }) => {
    await page.goto('/auth/register');

    const passwordInput = page.locator('#register-password');
    const confirmInput = page.locator('#register-confirm-password');

    await passwordInput.fill('MyPassword1!');
    await confirmInput.fill('WrongPassword');

    // Blur the field to trigger validation
    await confirmInput.blur();

    await expect(page.getByText("Passwords don't match")).toBeVisible();

    await page.screenshot({ path: screenshotPath('register-error-after-blur') });
  });

  test('error disappears when passwords match after blur', async ({ page }) => {
    await page.goto('/auth/register');

    const passwordInput = page.locator('#register-password');
    const confirmInput = page.locator('#register-confirm-password');

    await passwordInput.fill('MyPassword1!');
    await confirmInput.fill('WrongPassword');
    await confirmInput.blur();

    // Error should be visible
    await expect(page.getByText("Passwords don't match")).toBeVisible();

    // Now correct the confirm password to match
    await confirmInput.fill('MyPassword1!');

    // Error should be gone (passwords now match)
    await expect(page.getByText("Passwords don't match")).not.toBeVisible();

    await page.screenshot({ path: screenshotPath('register-error-gone-when-match') });
  });

  test('only one error message shown for confirm password at a time', async ({ page }) => {
    await page.goto('/auth/register');

    const confirmInput = page.locator('#register-confirm-password');

    // Type a non-matching value and blur
    await page.locator('#register-password').fill('MyPassword1!');
    await confirmInput.fill('Different');
    await confirmInput.blur();

    // There should be exactly one "Passwords don't match" message
    const errorMessages = page.getByText("Passwords don't match");
    await expect(errorMessages).toHaveCount(1);

    await page.screenshot({ path: screenshotPath('register-single-error-message') });
  });

  test('no error shown when confirm password is empty after blur', async ({ page }) => {
    await page.goto('/auth/register');

    const confirmInput = page.locator('#register-confirm-password');

    // Focus then blur without typing anything
    await confirmInput.focus();
    await confirmInput.blur();

    await expect(page.getByText("Passwords don't match")).not.toBeVisible();
  });

  test('stale server-side error clears when user edits confirm password field', async ({ page }) => {
    await page.goto('/auth/register');

    // Fill in form with mismatched passwords to get a field error from server
    await page.locator('#register-name').fill('Test User');
    await page.locator('#register-email').fill('test@example.com');
    await page.locator('#register-password').fill('MyPassword1!');
    await page.locator('#register-confirm-password').fill('DifferentPass1!');

    // Intercept the API call and return a validation error for confirmPassword
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: { confirmPassword: "Passwords don't match" },
        }),
      }),
    );

    await page.getByRole('button', { name: /create account/i }).click();

    // Server error should show
    await expect(page.getByText("Passwords don't match")).toBeVisible();

    // Now user corrects the confirm password field
    const confirmInput = page.locator('#register-confirm-password');
    await confirmInput.fill('MyPassword1!');

    // Stale field error must clear immediately on edit
    await expect(page.getByText("Passwords don't match")).not.toBeVisible();

    await page.screenshot({ path: screenshotPath('register-stale-error-cleared') });
  });
});


