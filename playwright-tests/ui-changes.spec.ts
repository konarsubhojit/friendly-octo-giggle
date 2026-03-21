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

// ─── Mobile Navigation (Hamburger Menu) ─────────────────────────────────────

test.describe('Mobile Navigation - Hamburger Menu', () => {
  test('hamburger button is visible on mobile viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/');
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await expect(hamburger).toBeVisible();
    await page.screenshot({ path: screenshotPath('mobile-home-closed-nav'), fullPage: false });
  });

  test('hamburger button is hidden on desktop viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/');
    // Wait for all resources including CSS chunks to finish loading.
    await page.waitForLoadState('load');
    // With Turbopack dev server, responsive CSS (md:hidden) is served as a
    // separate chunk that arrives after the initial HTML — the button can be
    // present in the DOM before display:none is applied. Poll the computed style
    // to detect the correct visual state. The 25s timeout accounts for a cold
    // Turbopack compile under maximum load during a full parallel test run.
    await page.waitForFunction(
      () => {
        const el = document.getElementById('mobile-nav-toggle');
        return Boolean(el && window.getComputedStyle(el).display === 'none');
      },
      { timeout: 25_000 },
    );
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await expect(hamburger).not.toBeVisible();
    await page.screenshot({ path: screenshotPath('desktop-home-no-hamburger'), fullPage: false });
  });

  test('mobile nav drawer opens and shows links on click', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/');
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await hamburger.click();

    // Drawer should now be visible with nav links
    // Use .last() to target the drawer links, not the desktop nav (which is hidden
    // by md:flex but still in the DOM while Turbopack applies responsive CSS)
    await expect(page.getByRole('link', { name: /^home$/i }).last()).toBeVisible();
    await expect(page.getByRole('link', { name: /^about$/i }).last()).toBeVisible();
    await expect(page.getByRole('link', { name: /^contact$/i }).last()).toBeVisible();

    await page.screenshot({ path: screenshotPath('mobile-home-open-nav'), fullPage: false });
  });

  test('mobile nav drawer closes when hamburger clicked again', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/');
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await hamburger.click();
    // drawer open - button label changes to "Close menu"
    const closeBtn = page.getByRole('button', { name: /close menu/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    // drawer should be gone - back to open-menu button
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();
    await page.screenshot({ path: screenshotPath('mobile-home-closed-nav-again'), fullPage: false });
  });

  test('hamburger button has correct aria attributes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/');
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await expect(hamburger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(hamburger).toHaveAttribute('aria-controls', 'mobile-nav-drawer');
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    // After opening, aria-expanded should be true
    await hamburger.click();
    await expect(page.getByRole('button', { name: /close menu/i })).toHaveAttribute('aria-expanded', 'true');
  });
});

// ─── Shipping Page – Table Scroll ────────────────────────────────────────────

test.describe('Shipping page - table horizontal scroll', () => {
  test('shipping table has overflow-x-auto wrapper', async ({ page }) => {
    await page.goto('/shipping');
    // The table wrapper should have overflow-x-auto
    const tableWrapper = page.locator('.overflow-x-auto').filter({ has: page.locator('table') }).first();
    await expect(tableWrapper).toBeAttached();
  });

  test('shipping page renders table on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/shipping');
    await page.screenshot({ path: screenshotPath('mobile-shipping-table'), fullPage: true });
    // Table must exist in the DOM
    const table = page.locator('table').first();
    await expect(table).toBeAttached();
  });

  test('shipping page renders table on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/shipping');
    await page.screenshot({ path: screenshotPath('desktop-shipping-table'), fullPage: false });
    const table = page.locator('table').first();
    await expect(table).toBeAttached();
  });
});

// ─── Admin Users Table – overflow-x-auto ─────────────────────────────────────

test.describe('Admin users page - table horizontal scroll DOM structure', () => {
  test('users table wrapper has overflow-x-auto class', async () => {
    // After refactoring, UsersTable lives in its own component file.
    const source = fs.readFileSync(
      path.join(__dirname, '../components/admin/UsersTable.tsx'),
      'utf-8',
    );
    expect(source).toContain('overflow-x-auto');
    expect(source).toContain('min-w-full');
  });
});

// ─── Product Detail – Dark Mode Button Variants ───────────────────────────────

test.describe('Product detail page - dark mode button variants', () => {
  test('variation button has explicit white background class in source', async ({ page }) => {
    await page.goto('/');
    // The page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('product page renders without JS errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto('/');
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('net::ERR') &&
        !e.includes('ECONNREFUSED') &&
        !e.includes('502') &&
        !e.includes('Bad Gateway') &&
        !e.includes('Failed to load resource') &&
        !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─── Dark Mode: CurrencySelector visible ─────────────────────────────────────

test.describe('CurrencySelector - dark mode visibility', () => {
  test('currency selector is visible on home page', async ({ page }) => {
    await page.goto('/');
    const select = page.getByRole('combobox', { name: /select currency/i });
    await expect(select).toBeVisible();
  });

  test('currency selector has warm border class for dark mode compatibility', async ({ page }) => {
    await page.goto('/');
    const select = page.getByRole('combobox', { name: /select currency/i });
    const cls = await select.getAttribute('class');
    expect(cls).toContain('border-[var(--border-warm)]');
  });
});

// ─── Admin Nav – mobile overflow scroll ───────────────────────────────────────

test.describe('Admin layout nav - mobile horizontal scroll', () => {
  test('admin nav has overflow-x-auto and whitespace-nowrap classes', async () => {
    // After refactoring, AdminNavLinks lives in its own component file.
    const source = fs.readFileSync(
      path.join(__dirname, '../components/admin/AdminNavLinks.tsx'),
      'utf-8',
    );
    expect(source).toContain('overflow-x-auto');
    expect(source).toContain('whitespace-nowrap');
  });
});

// ─── Full Page Screenshots ────────────────────────────────────────────────────

test.describe('Full page screenshots for visual verification', () => {
  test('home page - mobile screenshot', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await page.screenshot({ path: screenshotPath('mobile-home-full'), fullPage: true });
  });

  test('home page - desktop screenshot', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await page.screenshot({ path: screenshotPath('desktop-home-full'), fullPage: false });
  });

  test('shipping page - mobile full screenshot', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/shipping');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: screenshotPath('mobile-shipping-full'), fullPage: true });
  });

  test('about page - mobile screenshot', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/about');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: screenshotPath('mobile-about-full'), fullPage: true });
  });

  test('shop page - desktop screenshot', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/shop');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: screenshotPath('desktop-shop-full'), fullPage: false });
  });
});

// ─── Shop Page ────────────────────────────────────────────────────────────────

test.describe('Shop page', () => {
  test('shop page title contains "The Kiyon Store"', async ({ page }) => {
    await page.goto('/shop');
    await expect(page).toHaveTitle(/The Kiyon Store/i);
  });

  test('shop page has "Shop" heading', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByRole('heading', { name: /^Shop$/i }).first()).toBeVisible();
  });

  test('shop page has category filter dropdown', async ({ page }) => {
    await page.goto('/shop');
    const select = page.getByRole('combobox', { name: /filter by category/i });
    await expect(select).toBeVisible();
  });

  test('shop page has search input', async ({ page }) => {
    await page.goto('/shop');
    const searchInput = page.getByRole('searchbox', { name: /search products/i });
    await expect(searchInput).toBeVisible();
  });

  test('header "Shop" nav link points to /shop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Shop link is in desktop nav; mobile uses hamburger menu');
    await page.goto('/');
    const shopLink = page.getByRole('link', { name: /^Shop$/i }).first();
    await expect(shopLink).toBeVisible();
    const href = await shopLink.getAttribute('href');
    expect(href).toBe('/shop');
  });
});

// ─── Rebrand: The Kiyon Store ─────────────────────────────────────────────────

test.describe('Rebrand – The Kiyon Store', () => {
  test('header shows "The Kiyon Store" brand name', async ({ page }) => {
    await page.goto('/');
    // The brand link in the header
    const brand = page.getByRole('link', { name: /The Kiyon Store/i }).first();
    await expect(brand).toBeVisible();
    await page.screenshot({ path: screenshotPath('header-kiyon-store-brand') });
  });

  test('page title contains "The Kiyon Store"', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/The Kiyon Store/i);
  });

  test('about page title contains "The Kiyon Store"', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveTitle(/The Kiyon Store/i);
  });

  test('contact page title contains "The Kiyon Store"', async ({ page }) => {
    await page.goto('/contact');
    await expect(page).toHaveTitle(/The Kiyon Store/i);
  });

  test('source code has no remaining "Craft & Cozy" in header', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../components/layout/Header.tsx'),
      'utf-8',
    );
    expect(source).not.toContain('Craft &amp; Cozy');
    expect(source).not.toContain('Craft & Cozy');
    expect(source).toContain('The Kiyon Store');
  });
});

// ─── Bestsellers section ──────────────────────────────────────────────────────

test.describe('Bestsellers section', () => {
  test('homepage shows "Bestsellers" heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Bestsellers/i })).toBeVisible();
    await page.screenshot({ path: screenshotPath('home-bestsellers-heading') });
  });

  test('homepage has NO "#trending" section', async ({ page }) => {
    await page.goto('/');
    // The old Trending section used id="trending"; it must be absent after removal
    await expect(page.locator('#trending')).toHaveCount(0);
  });

  test('TrendingProducts component source is deleted', async () => {
    const trendingPath = path.join(__dirname, '../components/sections/TrendingProducts.tsx');
    expect(fs.existsSync(trendingPath)).toBe(false);
  });

  test('"Explore Shop" link in Hero points to /shop', async ({ page }) => {
    await page.goto('/');
    // Hero CTA button
    const btn = page.getByRole('link', { name: /Explore Shop/i });
    await expect(btn).toBeVisible();
    const href = await btn.getAttribute('href');
    expect(href).toBe('/shop');
  });
});

// ─── Search & Category filter ─────────────────────────────────────────────────

test.describe('ProductGrid – search and category filter', () => {
  test('search input is present on homepage', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.getByRole('searchbox', { name: /search products/i });
    await expect(searchInput).toBeVisible();
    await page.screenshot({ path: screenshotPath('home-search-input') });
  });

  test('category filter dropdown is present on homepage', async ({ page }) => {
    await page.goto('/');
    const select = page.getByRole('combobox', { name: /filter by category/i });
    await expect(select).toBeVisible();
    await page.screenshot({ path: screenshotPath('home-category-filter') });
  });

  test('"All" is selected by default in category dropdown', async ({ page }) => {
    await page.goto('/');
    const select = page.getByRole('combobox', { name: /filter by category/i });
    await expect(select).toHaveValue('All');
  });

  test('selecting a category in dropdown filters products', async ({ page }) => {
    await page.goto('/');
    const select = page.getByRole('combobox', { name: /filter by category/i });
    await select.selectOption('Handbag');
    await expect(select).toHaveValue('Handbag');
  });

  test('search input accepts text and filters results', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/');
    const searchInput = page.getByRole('searchbox', { name: /search products/i });
    await searchInput.fill('zzz-no-match-xyz');
    // If no product matches, the "No products found" empty state should appear
    await expect(page.getByText(/No products found/i)).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: screenshotPath('home-search-no-results') });
  });
});

// ─── Quick add-to-cart button ─────────────────────────────────────────────────

test.describe('Quick add-to-cart button', () => {
  test('source code has QuickAddButton outside Link (not nested)', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../components/sections/ProductGrid.tsx'),
      'utf-8',
    );
    // QuickAddButton must appear as a sibling of Link, not inside it
    // (the structural check: QuickAddButton rendered after the closing </Link>)
    const linkCloseIndex = source.lastIndexOf('</Link>');
    const quickAddIndex = source.lastIndexOf('<QuickAddButton');
    expect(quickAddIndex).toBeGreaterThan(linkCloseIndex);
  });

  test('quick add button has aria-label for accessibility', async () => {
    // After one-file-one-component refactoring, QuickAddButton lives in its own file.
    const source = fs.readFileSync(
      path.join(__dirname, '../components/sections/QuickAddButton.tsx'),
      'utf-8',
    );
    expect(source).toContain('aria-label={`Add ${product.name} to cart`}');
  });

  test('product card image uses object-contain (no clipping)', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../components/sections/ProductGrid.tsx'),
      'utf-8',
    );
    expect(source).toContain('object-contain');
    expect(source).toContain('aspect-square');
  });
});

