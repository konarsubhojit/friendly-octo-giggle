import { test, expect } from '@playwright/test';
import { join, dirname } from 'path';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = join(__dirname, 'screenshots');

const screenshotPath = (name: string) => join(SCREENSHOT_DIR, `${name}.png`);

test.beforeAll(() => {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

// ─── Fixed Background Image ──────────────────────────────────────────────────

test.describe('Fixed background image — warm-bg.jpeg', () => {

  // ── Source CSS assertions ────────────────────────────────────────────────

  test('bg-warm-gradient utility includes fixed warm-bg image and color-mix overlay', () => {
    const css = readFileSync(
      join(__dirname, '../app/globals.css'),
      'utf-8',
    );
    // Fixed background image is scoped to bg-warm-gradient, not body
    expect(css).toContain("url('/warm-bg.jpeg')");
    expect(css).toContain('fixed');
    expect(css).toContain('color-mix(in srgb, var(--background) 60%, transparent)');
    expect(css).toContain('color-mix(in srgb, var(--accent-blush) 60%, transparent)');
    expect(css).toContain('color-mix(in srgb, var(--accent-cream) 60%, transparent)');
  });

  test('body does NOT set background-image (scoped to bg-warm-gradient only)', () => {
    const css = readFileSync(
      join(__dirname, '../app/globals.css'),
      'utf-8',
    );
    // Extract the body rule — it should NOT contain background-image
    const bodyRule = css.match(/body\s*\{[^}]*\}/)?.[0] ?? '';
    expect(bodyRule).not.toContain('background-image');
    expect(bodyRule).not.toContain('warm-bg.jpeg');
  });

  // ── Computed style assertions on .bg-warm-gradient wrapper ──────────────

  test('bg-warm-gradient wrapper has fixed background-image on blog page', async ({ page }) => {
    await page.goto('/blog');
    const bgImage = await page.evaluate(() => {
      const el = document.querySelector('.bg-warm-gradient');
      return el ? window.getComputedStyle(el).backgroundImage : '';
    });
    expect(bgImage).toContain('warm-bg.jpeg');
  });

  test('bg-warm-gradient wrapper has fixed background-attachment on blog page', async ({ page }) => {
    await page.goto('/blog');
    const bgAttachment = await page.evaluate(() => {
      const el = document.querySelector('.bg-warm-gradient');
      return el ? window.getComputedStyle(el).backgroundAttachment : '';
    });
    // Multi-background: gradient is scroll, image is fixed
    expect(bgAttachment).toContain('fixed');
  });

  test('bg-warm-gradient wrapper has background-size: cover on blog page', async ({ page }) => {
    await page.goto('/blog');
    const bgSize = await page.evaluate(() => {
      const el = document.querySelector('.bg-warm-gradient');
      return el ? window.getComputedStyle(el).backgroundSize : '';
    });
    expect(bgSize).toContain('cover');
  });

  test('fixed background is consistent across multiple pages', async ({ page }) => {
    const pages = ['/', '/about', '/contact', '/shipping', '/blog'];
    for (const url of pages) {
      await page.goto(url);
      const bgImage = await page.evaluate(() => {
        const el = document.querySelector('.bg-warm-gradient');
        return el ? window.getComputedStyle(el).backgroundImage : '';
      });
      expect(bgImage, `Expected warm-bg on ${url}`).toContain('warm-bg.jpeg');
      const bgAttachment = await page.evaluate(() => {
        const el = document.querySelector('.bg-warm-gradient');
        return el ? window.getComputedStyle(el).backgroundAttachment : '';
      });
      expect(bgAttachment, `Expected fixed attachment on ${url}`).toContain('fixed');
    }
  });

  // ── Scroll behavior ─────────────────────────────────────────────────────

  test('background stays fixed after scrolling — about page (desktop)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/about');
    await page.waitForLoadState('load');

    await page.screenshot({ path: screenshotPath('fixed-bg-about-top'), fullPage: false });

    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(300);

    await page.screenshot({ path: screenshotPath('fixed-bg-about-scrolled'), fullPage: false });

    const bgAttachment = await page.evaluate(() => {
      const el = document.querySelector('.bg-warm-gradient');
      return el ? window.getComputedStyle(el).backgroundAttachment : '';
    });
    expect(bgAttachment).toContain('fixed');
  });

  test('background stays fixed after scrolling — blog page (mobile)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/blog');
    await page.waitForLoadState('load');

    await page.screenshot({ path: screenshotPath('fixed-bg-mobile-blog-top'), fullPage: false });

    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    await page.screenshot({ path: screenshotPath('fixed-bg-mobile-blog-scrolled'), fullPage: false });

    const bgAttachment = await page.evaluate(() => {
      const el = document.querySelector('.bg-warm-gradient');
      return el ? window.getComputedStyle(el).backgroundAttachment : '';
    });
    expect(bgAttachment).toContain('fixed');
  });

  // ── Full page screenshots ───────────────────────────────────────────────

  test('full page screenshot — blog with fixed background (desktop)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/blog');
    await expect(page.locator('header')).toBeVisible();
    await page.screenshot({ path: screenshotPath('fixed-bg-desktop-blog-full'), fullPage: true });
  });

  test('full page screenshot — about with fixed background (desktop)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/about');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: screenshotPath('fixed-bg-desktop-about-full'), fullPage: true });
  });

  test('full page screenshot — contact with fixed background (mobile)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/contact');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: screenshotPath('fixed-bg-mobile-contact-full'), fullPage: true });
  });

  test('full page screenshot — shipping with fixed background (mobile)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Only runs on mobile viewport');
    await page.goto('/shipping');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: screenshotPath('fixed-bg-mobile-shipping-full'), fullPage: true });
  });

  // ── Asset check ─────────────────────────────────────────────────────────

  test('warm-bg.jpeg file exists in public directory', () => {
    const bgPath = join(__dirname, '../public/warm-bg.jpeg');
    expect(existsSync(bgPath)).toBe(true);
  });

  // ── Overlay transparency — inspects .bg-warm-gradient container ─────────

  test('bg-warm-gradient overlay is semi-transparent (background has gradient + image)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Only runs on desktop viewport');
    await page.goto('/blog');
    const bg = await page.evaluate(() => {
      const el = document.querySelector('.bg-warm-gradient');
      if (!el) return { image: '', attachment: '', size: '' };
      const style = window.getComputedStyle(el);
      return {
        image: style.backgroundImage,
        attachment: style.backgroundAttachment,
        size: style.backgroundSize,
      };
    });
    // Multi-background: gradient layer + image layer
    expect(bg.image).toContain('linear-gradient');
    expect(bg.image).toContain('warm-bg.jpeg');
    expect(bg.attachment).toContain('fixed');
    expect(bg.size).toContain('cover');
  });

  // ── Admin isolation ─────────────────────────────────────────────────────

  test('admin pages do NOT use bg-warm-gradient (separate styling)', () => {
    const adminLayout = readFileSync(
      join(__dirname, '../app/admin/layout.tsx'),
      'utf-8',
    );
    expect(adminLayout).toContain('bg-gray-50');
    expect(adminLayout).not.toContain('bg-warm-gradient');
  });

  test('blog page uses bg-warm-gradient overlay class', () => {
    const blogPage = readFileSync(
      join(__dirname, '../app/blog/page.tsx'),
      'utf-8',
    );
    expect(blogPage).toContain('bg-warm-gradient');
  });
});
