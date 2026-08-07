import base from './playwright.config'
import { defineConfig } from '@playwright/test'

// Temporary, uncommitted config for spec 015 T022: run the existing suite
// against `next start` (a production build with the React Compiler on).
// `next start` enforces the production HTTP→HTTPS redirect, so requests carry
// the x-forwarded-proto header a real proxy would set, and no local dev server
// is managed.
export default defineConfig({
  ...base,
  testDir: '/home/runner/work/friendly-octo-giggle/friendly-octo-giggle/playwright-tests',
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: 'https://localhost:3443',
  },
})
