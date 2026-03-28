/**
 * Playwright global setup — runs once before all test projects.
 *
 * Authenticates via NextAuth credentials (email/password) from env vars
 * and saves the resulting session state so authenticated test projects
 * can skip the sign-in flow entirely.
 */
import { chromium } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(process.cwd(), ".env") });
loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });

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
    if (fs.existsSync(AUTH_STATE_PATH)) {
      return;
    }
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
    await page.waitForSelector('input[name="identifier"]', {
      timeout: 15000,
    });

    await page.fill('input[name="identifier"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), {
      timeout: 15000,
    });

    await context.storageState({ path: AUTH_STATE_PATH });
  } catch (err) {
    // Authentication can fail when the database is unavailable (e.g. the Neon
    // preview branch hasn't been created yet for this PR).  In that case we
    // emit a warning and write an empty storage-state file so unauthenticated
    // test projects can still run.  Authenticated projects will skip or fail
    // individually, which is the expected behaviour without a live database.
    console.warn(
      `⚠️  Playwright auth failed (database may be unavailable): ${err instanceof Error ? err.message : String(err)}\n` +
        "   Unauthenticated tests will still run.  Authenticated tests require a live database.",
    );
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      fs.writeFileSync(
        AUTH_STATE_PATH,
        JSON.stringify({ cookies: [], origins: [] }),
      );
    }
  } finally {
    await browser.close();
  }
}
