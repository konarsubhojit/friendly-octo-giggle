/**
 * Playwright global setup — runs once before all test projects.
 *
 * Authenticates via NextAuth credentials (email/password) from env vars
 * and saves the resulting session state so authenticated test projects
 * can skip the sign-in flow entirely.
 */
import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const AUTH_STATE_PATH = path.join(__dirname, ".auth", "admin.json");
const BASE_URL = "https://localhost:3000";

export default async function globalSetup() {
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const email = process.env.COPILOT_DEV_EMAIL;
  const password = process.env.COPILOT_DEV_PASS;
  if (!email || !password) {
    throw new Error(
      "COPILOT_DEV_EMAIL and COPILOT_DEV_PASS must be set in .env for Playwright auth",
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
  });

  try {
    const page = await context.newPage();

    await page.goto("/auth/signin");
    await page.waitForSelector('input[type="email"], input[name="email"]', {
      timeout: 15000,
    });

    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), {
      timeout: 15000,
    });

    await context.storageState({ path: AUTH_STATE_PATH });
  } finally {
    await browser.close();
  }
}
