/**
 * Admin view tests — run as the Copilot admin account using the stored
 * session state from global-setup.ts.
 *
 * Every admin API call is intercepted by Playwright route mocks so the
 * tests are fully deterministic and require no real database.
 */
import { test, expect, Page } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MOCK_PRODUCTS,
  MOCK_ORDERS,
  MOCK_USERS,
  MOCK_SALES,
} from "./mock-data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const ADMIN_ORDER_DETAIL_PATTERN = /\/api\/admin\/orders\/[^/]+$/;
const ADMIN_USER_DETAIL_PATTERN = /\/api\/admin\/users\/[^/]+$/;

function screenshotPath(name: string) {
  return path.join(SCREENSHOT_DIR, `${name}.png`);
}

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

// ─── Route mocks ─────────────────────────────────────────────────────────────

async function mockAdminRoutes(page: Page) {
  await page.route("**/api/admin/sales**", (route) =>
    route.fulfill({ json: { success: true, data: { sales: MOCK_SALES } } }),
  );
  await page.route("**/api/admin/products**", (route) =>
    route.fulfill({
      json: { success: true, data: { products: MOCK_PRODUCTS } },
    }),
  );
  await page.route("**/api/admin/orders**", (route) => {
    const url = route.request().url();
    if (ADMIN_ORDER_DETAIL_PATTERN.test(url)) {
      return route.fulfill({
        json: { success: true, data: { order: MOCK_ORDERS[0] } },
      });
    }
    return route.fulfill({
      json: { success: true, data: { orders: MOCK_ORDERS } },
    });
  });
  await page.route("**/api/admin/users**", (route) => {
    const url = route.request().url();
    if (ADMIN_USER_DETAIL_PATTERN.test(url)) {
      return route.fulfill({
        json: { success: true, data: { user: MOCK_USERS[0] } },
      });
    }
    return route.fulfill({
      json: { success: true, data: { users: MOCK_USERS } },
    });
  });
  // Suppress exchange-rates errors (Redis not available)
  await page.route("**/api/exchange-rates**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 } },
      },
    }),
  );
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

test.describe("Admin Dashboard", () => {
  test("renders dashboard with sales summary", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();

    // Wait for loading state to clear and stat cards to appear
    await expect(page.getByText("Total Revenue")).toBeVisible();
    await expect(page.getByText("Total Orders")).toBeVisible();
    await page.screenshot({
      path: screenshotPath("admin-dashboard"),
      fullPage: true,
    });
  });

  test("top products table is visible", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin");
    // Wait for data to load (loading spinner disappears when data arrives)
    await expect(page.getByText("Top 5 Selling Products")).toBeVisible();
    await expect(
      page.getByText("Hand-knitted Flower Bouquet").first(),
    ).toBeVisible();
    await expect(page.getByText("Macramé Wall Hanging").first()).toBeVisible();
    await page.screenshot({
      path: screenshotPath("admin-dashboard-table"),
      fullPage: true,
    });
  });

  test("nav links render all sections", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin");
    await expect(
      page.getByRole("link", { name: /products/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /orders/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /users/i }).first(),
    ).toBeVisible();
  });
});

// ─── Admin Products ───────────────────────────────────────────────────────────

test.describe("Admin Products", () => {
  test("renders product grid with all mock products", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/products");
    await expect(
      page.getByRole("heading", { name: /product management/i }),
    ).toBeVisible();

    // Wait for the Redux data to load — first product is the signal
    await expect(
      page.getByText("Hand-knitted Flower Bouquet").first(),
    ).toBeVisible({ timeout: 10_000 });
    // All 6 products should appear
    for (const product of MOCK_PRODUCTS) {
      await expect(page.getByText(product.name).first()).toBeVisible();
    }
    await page.screenshot({
      path: screenshotPath("admin-products"),
      fullPage: true,
    });
  });

  test("product cards show price and stock", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/products", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /product management/i }),
    ).toBeVisible();
    await expect(page.getByText(/stock:/i).first()).toBeVisible();
  });

  test("Add Product button is visible", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/products");
    await expect(
      page.getByRole("button", { name: /add product/i }),
    ).toBeVisible();
  });

  test("Edit and Delete buttons on each card", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/products");
    const editBtns = page.getByRole("button", { name: /edit/i });
    await expect(editBtns.first()).toBeVisible();
    const deleteBtns = page.getByRole("button", { name: /delete/i });
    await expect(deleteBtns.first()).toBeVisible();
  });
});

// ─── Admin Orders ─────────────────────────────────────────────────────────────

test.describe("Admin Orders", () => {
  test("renders order management with all mock orders", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/orders");
    await expect(
      page.getByRole("heading", { name: /order management/i }),
    ).toBeVisible();

    // All customers should appear
    for (const order of MOCK_ORDERS) {
      await expect(page.getByText(order.customerName)).toBeVisible();
    }
    await page.screenshot({
      path: screenshotPath("admin-orders"),
      fullPage: true,
    });
  });

  test("shows all order statuses", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/orders");
    const statuses = [
      "DELIVERED",
      "SHIPPED",
      "PROCESSING",
      "PENDING",
      "CANCELLED",
    ];
    for (const status of statuses) {
      await expect(page.getByText(status).first()).toBeVisible();
    }
    await page.screenshot({
      path: screenshotPath("admin-orders-statuses"),
      fullPage: true,
    });
  });

  test("shows customer address and email", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/orders");
    await expect(page.getByText("priya.sharma@example.com")).toBeVisible();
  });
});

// ─── Admin Users ──────────────────────────────────────────────────────────────

test.describe("Admin Users", () => {
  test("renders user management table with all mock users", async ({
    page,
  }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: /user management/i }),
    ).toBeVisible();

    for (const user of MOCK_USERS) {
      await expect(page.getByText(user.email)).toBeVisible();
    }
    await page.screenshot({
      path: screenshotPath("admin-users"),
      fullPage: true,
    });
  });

  test("table has overflow-x-auto wrapper for mobile scroll", async ({
    page,
  }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/users");
    const tableWrapper = page
      .locator(".overflow-x-auto")
      .filter({ has: page.locator("table") });
    await expect(tableWrapper.first()).toBeAttached();
  });

  test("shows ADMIN and CUSTOMER role badges", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/users");
    await expect(page.getByText("ADMIN").first()).toBeVisible();
    await expect(page.getByText("CUSTOMER").first()).toBeVisible();
  });

  test("users page - mobile view card layout", async ({ page }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "Only runs on mobile viewport",
    );
    await mockAdminRoutes(page);
    await page.goto("/admin/users");
    await expect(page.getByText(MOCK_USERS[0].email)).toBeVisible();
    await page.screenshot({
      path: screenshotPath("admin-users-mobile"),
      fullPage: true,
    });
  });
});

// ─── Admin header and nav ─────────────────────────────────────────────────────

test.describe("Admin layout", () => {
  test("shows logged-in user name in header", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin");
    await expect(page.getByText(/copilot admin/i)).toBeVisible();
  });

  test("nav links are scrollable on mobile", async ({ page }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "Only runs on mobile viewport",
    );
    await mockAdminRoutes(page);
    await page.goto("/admin");
    const nav = page
      .locator("nav.overflow-x-auto, nav .overflow-x-auto")
      .first();
    await expect(nav).toBeAttached();
    await page.screenshot({
      path: screenshotPath("admin-nav-mobile"),
      fullPage: false,
    });
  });
});

// ─── Admin Orders – Status Change Confirmation ────────────────────────────────

test.describe("Admin Orders - status change confirmation", () => {
  test("shows confirm dialog when status is changed", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/orders");
    // Wait for orders to load
    await expect(page.getByText("Order Management")).toBeVisible();

    // Find the first status select and change it to a different value
    const statusSelect = page.getByLabel(/change status for order/i).first();
    await statusSelect.selectOption({ label: "PROCESSING" });

    // The confirm dialog should appear
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Change Order Status")).toBeVisible();
    await page.screenshot({
      path: screenshotPath("admin-order-status-confirm-dialog"),
      fullPage: false,
    });
  });

  test("cancels status change when Cancel is clicked in dialog", async ({
    page,
  }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/orders");
    await expect(page.getByText("Order Management")).toBeVisible();

    const statusSelect = page.getByLabel(/change status for order/i).first();
    const originalStatus = await statusSelect.inputValue();
    await statusSelect.selectOption({ index: 1 });

    // Confirm dialog appears; click Cancel
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: /cancel/i })
      .last()
      .click();

    // Dialog should be gone and no PATCH request should have been made
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // Select should still show original value
    await expect(statusSelect).toHaveValue(originalStatus);
    await page.screenshot({
      path: screenshotPath("admin-order-status-cancelled"),
      fullPage: false,
    });
  });
});

// ─── Admin Users – Role Change Confirmation ────────────────────────────────────

test.describe("Admin Users - role change confirmation", () => {
  test("shows confirm dialog when role is changed", async ({ page }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/users");
    await expect(page.getByText("User Management")).toBeVisible();

    // Find a CUSTOMER role select (the second user in MOCK_USERS is a CUSTOMER)
    // and switch to ADMIN. Use .nth(1) to skip the first row (which is already ADMIN).
    const roleSelect = page.getByLabel(/change role for/i).nth(1);
    await roleSelect.selectOption("ADMIN");

    // Confirm dialog should appear
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Change User Role")).toBeVisible();
    await page.screenshot({
      path: screenshotPath("admin-user-role-confirm-dialog"),
      fullPage: false,
    });
  });

  test("cancels role change when Cancel is clicked in dialog", async ({
    page,
  }) => {
    await mockAdminRoutes(page);
    await page.goto("/admin/users");
    await expect(page.getByText("User Management")).toBeVisible();

    // Use the second user (a CUSTOMER) to avoid hitting the "can't change own role" guard
    const roleSelect = page.getByLabel(/change role for/i).nth(1);
    const originalRole = await roleSelect.inputValue();
    const newRole = originalRole === "CUSTOMER" ? "ADMIN" : "CUSTOMER";
    await roleSelect.selectOption(newRole);

    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: /cancel/i })
      .last()
      .click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(roleSelect).toHaveValue(originalRole);
    await page.screenshot({
      path: screenshotPath("admin-user-role-cancelled"),
      fullPage: false,
    });
  });
});
