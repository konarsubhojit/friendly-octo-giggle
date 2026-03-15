/**
 * Account page – confirm new password field validation tests.
 *
 * Runs as the Copilot admin account (storageState from global-setup).
 * The /api/account endpoint is mocked so that hasPassword: true is returned,
 * making the Password section visible regardless of the real DB state.
 *
 * Covers:
 * - Password section shows "Change Password" button (no form by default)
 * - Clicking "Change Password" reveals the form
 * - No "Passwords don't match" shown while typing (before blur)
 * - Error appears after blurring when passwords differ
 * - Error disappears when passwords match after blur
 */
import { test, expect } from '@playwright/test';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = join(__dirname, 'screenshots');

function screenshotPath(name: string) {
  return join(SCREENSHOT_DIR, `${name}.png`);
}

test.beforeAll(() => {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
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

const goToAccountWithPassword = async (page: import('@playwright/test').Page) => {
  // Mock /api/account so hasPassword: true, which shows the Password section
  await page.route('**/api/account**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: { success: true, data: MOCK_PROFILE },
      });
    }
    return route.continue();
  });
  await page.goto('/account');
  // Wait for the Password section heading to appear
  await expect(page.getByRole('heading', { name: /^password$/i })).toBeVisible();
}

const openChangePasswordForm = async (page: import('@playwright/test').Page) => {
  await goToAccountWithPassword(page);
  // Click the "Change Password" button to reveal the form
  await page.getByRole('button', { name: /change password/i }).click();
  // Wait for the form to appear
  await expect(page.locator('#current-password')).toBeVisible();
}

test.describe('Account page - read-only by default', () => {
  test('profile information is shown in read-only mode on load', async ({ page }) => {
    await goToAccountWithPassword(page);
    // The profile should show as read-only description list
    await expect(page.getByText('Copilot Admin')).toBeVisible();
    // The edit form should NOT be visible
    await expect(page.locator('#account-name')).not.toBeVisible();
    await page.screenshot({ path: screenshotPath('account-readonly-profile') });
  });

  test('Edit button shows the profile edit form', async ({ page }) => {
    await goToAccountWithPassword(page);
    await page.getByRole('button', { name: /edit profile/i }).click();
    // Form inputs should now be visible
    await expect(page.locator('#account-name')).toBeVisible();
    await expect(page.locator('#account-email')).toBeVisible();
    await page.screenshot({ path: screenshotPath('account-edit-form-open') });
  });

  test('Cancel button hides the profile edit form', async ({ page }) => {
    await goToAccountWithPassword(page);
    await page.getByRole('button', { name: /edit profile/i }).click();
    await expect(page.locator('#account-name')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).first().click();
    await expect(page.locator('#account-name')).not.toBeVisible();
    await page.screenshot({ path: screenshotPath('account-edit-form-cancelled') });
  });

  test('password form is hidden by default', async ({ page }) => {
    await goToAccountWithPassword(page);
    await expect(page.locator('#current-password')).not.toBeVisible();
    await page.screenshot({ path: screenshotPath('account-password-hidden-by-default') });
  });

  test('Change Password button reveals the password form', async ({ page }) => {
    await openChangePasswordForm(page);
    await expect(page.locator('#new-password')).toBeVisible();
    await expect(page.locator('#confirm-new-password')).toBeVisible();
    await page.screenshot({ path: screenshotPath('account-password-form-open') });
  });
});

test.describe('Account page - profile form validation', () => {
  test('shows name required error when name is empty on save', async ({ page }) => {
    await goToAccountWithPassword(page);
    await page.getByRole('button', { name: /edit profile/i }).click();
    // Clear the name field
    await page.locator('#account-name').fill('');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Name is required.')).toBeVisible();
    await page.screenshot({ path: screenshotPath('account-profile-name-error') });
  });

  test('shows email error for invalid email on save', async ({ page }) => {
    await goToAccountWithPassword(page);
    await page.getByRole('button', { name: /edit profile/i }).click();
    await page.locator('#account-email').fill('not-an-email');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await page.screenshot({ path: screenshotPath('account-profile-email-error') });
  });

  test('shows phone error for invalid phone on save', async ({ page }) => {
    await goToAccountWithPassword(page);
    await page.getByRole('button', { name: /edit profile/i }).click();
    await page.locator('#account-phone').fill('bad-phone');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Enter a valid phone number')).toBeVisible();
    await page.screenshot({ path: screenshotPath('account-profile-phone-error') });
  });

  test('error clears when name is corrected', async ({ page }) => {
    await goToAccountWithPassword(page);
    await page.getByRole('button', { name: /edit profile/i }).click();
    await page.locator('#account-name').fill('');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Name is required.')).toBeVisible();
    // Fix the value
    await page.locator('#account-name').fill('Alice');
    await expect(page.getByText('Name is required.')).not.toBeVisible();
  });
});

test.describe('Account page - confirm new password validation', () => {
  test('no error shown while typing in confirm password field before blur', async ({ page }) => {
    await openChangePasswordForm(page);

    await page.locator('#confirm-new-password').fill('Different');

    // Error must NOT appear while the field is still focused (not blurred)
    await expect(page.getByText("Passwords don't match")).not.toBeVisible();

    await page.screenshot({ path: screenshotPath('account-no-error-while-typing') });
  });

  test('error shown after blurring confirm new password when passwords do not match', async ({ page }) => {
    await openChangePasswordForm(page);

    await page.locator('#new-password').fill('MyPassword1!');
    await page.locator('#confirm-new-password').fill('WrongPassword');
    await page.locator('#confirm-new-password').blur();

    await expect(page.getByText("Passwords don't match")).toBeVisible();

    await page.screenshot({ path: screenshotPath('account-error-after-blur') });
  });

  test('error disappears when confirm new password is corrected to match', async ({ page }) => {
    await openChangePasswordForm(page);

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
    await openChangePasswordForm(page);

    const confirmInput = page.locator('#confirm-new-password');
    await confirmInput.focus();
    await confirmInput.blur();

    await expect(page.getByText("Passwords don't match")).not.toBeVisible();
  });

  test('shows validation errors when submitting empty password form', async ({ page }) => {
    await openChangePasswordForm(page);
    // Click Change Password submit button without filling fields
    await page.getByRole('button', { name: /^change password$/i }).click();
    await expect(page.getByText('Current password is required.')).toBeVisible();
    await page.screenshot({ path: screenshotPath('account-password-validation-errors') });
  });

  test('Cancel button hides the password form', async ({ page }) => {
    await openChangePasswordForm(page);
    await page.getByRole('button', { name: /cancel/i }).last().click();
    await expect(page.locator('#current-password')).not.toBeVisible();
    await page.screenshot({ path: screenshotPath('account-password-form-cancelled') });
  });
});
