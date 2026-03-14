import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright-tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    // Bypass the proxy middleware HTTP→HTTPS redirect by setting the forwarded-proto header
    extraHTTPHeaders: {
      'x-forwarded-proto': 'https',
    },
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], viewport: { width: 393, height: 851 } },
    },
  ],
  reporter: [['list'], ['html', { outputFolder: 'playwright-tests/report', open: 'never' }]],
});
