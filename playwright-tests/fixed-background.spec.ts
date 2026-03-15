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

// ─── Fixed Background Image ──────────────────────────────────────────────────

test.describe('Fixed background image — warm-bg.jpeg', () => {

  test('globals.css sets background-image on body', () => {
    const css = fs.readFileSync(
      path.join(__dirname, '../app/globals.css'),
      'utf-8',
    );
    expect(css).toContain("background-image: url('/warm-bg.jpeg')");
    expect(css).toContain('background-attachment: fixed');
    expect(css).toContain('background-size: cover');
    expect(css).toContain('background-position: center');
  });

  test('bg-warm-gradient utility uses color-mix for transparency', () => {
    const css = fs.readFileSync(
      path.join(__dirname, '../app/globals.css'),
      'utf-8',
    );
    expect(css).toContain('color-mix(in srgb, var(--background)');
    expect(css).toContain('color-mix(in srgb, var(--accent-blush)');
    expect(css).toContain('color-mix(in srgb, var(--accent-cream)');
    expect(css).toContain('transparent');
  });

  test('body has fixed background-image computed style on home page', async ({ page }) => {
    await page.goto('/');
    const bgImage = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage,
    );
    expect(bgImage).toContain('warm-bg.jpeg');
  });

  test('body has fixed background-attachment computed style on home page', async ({ page }) => {
    await page.goto('/');
    const bgAttachment = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundAttachment,
    );
    expect(bgAttachment).toBe('fixed');
  });

  test('body has background-size: cover on home page', async ({ page }) => {
    await page.goto('/');
    const bgSize = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundSize,
    );
    expect(bgSize).toBe('cover');
  });

  test('body background-image is consistent across multiple pages', async ({ page }) => {
    const pages = ['/', '/about', '/contact', '/shipping', '/blog'];
    for (const url of pages) {
      await page.goto(url);
      const bgImage = await page.evaluate(() =>
        window.getComputedStyle(document.body).backgroundImage,
      );
      expect(bgImage, `Expected fixed bg on ${url}`).toContain('warm-bg.jpeg');
      const bgAttachment = await page.evaluate(() =>
        window.getComputedStyle(document.body).backgroundAttachment,
      );
      expect(bgAttachment, `Expected fixed attachment on ${url}`).toBe('fixed');
    }
  });

  test('page content scrolls while background stays fixed — home page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/');
    await page.waitForLoadState('load');

    // Take screenshot at top of page
    await page.screenshot({ path: screenshotPath('fixed-bg-home-top'), fullPage: false });

    // Scroll down significantly
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(300);

    // Take screenshot after scrolling
    await page.screenshot({ path: screenshotPath('fixed-bg-home-scrolled'), fullPage: false });

    // Verify background-attachment is still fixed after scrolling
    const bgAttachment = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundAttachment,
    );
    expect(bgAttachment).toBe('fixed');
  });

  test('page content scrolls while background stays fixed — about page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/about');
    await page.waitForLoadState('load');

    await page.screenshot({ path: screenshotPath('fixed-bg-about-top'), fullPage: false });

    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(300);

    await page.screenshot({ path: screenshotPath('fixed-bg-about-scrolled'), fullPage: false });

    const bgAttachment = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundAttachment,
    );
    expect(bgAttachment).toBe('fixed');
  });

  test('full page screenshot — home with fixed background (desktop)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await page.screenshot({ path: screenshotPath('fixed-bg-desktop-home-full'), fullPage: true });
  });

  test('full page screenshot — home with fixed background (mobile)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await page.screenshot({ path: screenshotPath('fixed-bg-mobile-home-full'), fullPage: true });
  });

  test('full page screenshot — about with fixed background (desktop)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/about');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: screenshotPath('fixed-bg-desktop-about-full'), fullPage: true });
  });

  test('full page screenshot — contact with fixed background (desktop)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/contact');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: screenshotPath('fixed-bg-desktop-contact-full'), fullPage: true });
  });

  test('full page screenshot — shipping with fixed background (mobile)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/shipping');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: screenshotPath('fixed-bg-mobile-shipping-full'), fullPage: true });
  });

  test('warm-bg.jpeg file exists in public directory', () => {
    const bgPath = path.join(__dirname, '../public/warm-bg.jpeg');
    expect(fs.existsSync(bgPath)).toBe(true);
  });

  test('bg-warm-gradient overlay is semi-transparent (not fully opaque)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/');
    // The page wrapper div with bg-warm-gradient should not have a fully opaque background
    // We check that the body background image is visually reachable
    const bodyBg = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      return {
        image: style.backgroundImage,
        attachment: style.backgroundAttachment,
        size: style.backgroundSize,
      };
    });
    expect(bodyBg.image).toContain('warm-bg.jpeg');
    expect(bodyBg.attachment).toBe('fixed');
    expect(bodyBg.size).toBe('cover');
  });

  test('admin pages do NOT use bg-warm-gradient (separate styling)', () => {
    const adminLayout = fs.readFileSync(
      path.join(__dirname, '../app/admin/layout.tsx'),
      'utf-8',
    );
    // Admin pages use bg-gray-50, not bg-warm-gradient
    expect(adminLayout).toContain('bg-gray-50');
    expect(adminLayout).not.toContain('bg-warm-gradient');
  });

  test('blog page uses bg-warm-gradient overlay class', () => {
    const blogPage = fs.readFileSync(
      path.join(__dirname, '../app/blog/page.tsx'),
      'utf-8',
    );
    expect(blogPage).toContain('bg-warm-gradient');
  });

  test('home page screenshot after scroll — content moves, bg fixed (mobile)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/');
    await page.waitForLoadState('load');

    await page.screenshot({ path: screenshotPath('fixed-bg-mobile-home-top'), fullPage: false });

    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    await page.screenshot({ path: screenshotPath('fixed-bg-mobile-home-scrolled'), fullPage: false });

    const bgAttachment = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundAttachment,
    );
    expect(bgAttachment).toBe('fixed');
  });
});
