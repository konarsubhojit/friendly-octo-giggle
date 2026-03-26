import { test, expect } from "@playwright/test";
import { MOCK_CART } from "./mock-data.js";

test.describe("Checkout policy confirmation", () => {
  test("requires acknowledgment before checkout is submitted", async ({
    page,
  }) => {
    let checkoutRequests = 0;

    await page.route("**/api/exchange-rates**", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 } },
        },
      }),
    );

    await page.route("**/api/cart", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { cart: MOCK_CART } });
        return;
      }

      if (route.request().method() === "DELETE") {
        await route.fulfill({ json: { success: true } });
        return;
      }

      await route.continue();
    });

    await page.route("**/api/checkout", async (route) => {
      checkoutRequests += 1;
      await route.fulfill({
        json: { checkoutRequestId: "chk-test-001", status: "PENDING" },
        status: 202,
      });
    });

    await page.route("**/api/checkout/**", (route) =>
      route.fulfill({
        json: {
          checkoutRequestId: "chk-test-001",
          status: "COMPLETED",
          orderId: "ord-test-001",
          error: null,
        },
      }),
    );

    await page.goto("/cart");
    await page
      .getByLabel(/shipping address/i)
      .fill("42 MG Road, Bengaluru, Karnataka 560001");
    await page.getByRole("button", { name: /place order/i }).click();

    await expect(
      page.getByRole("heading", { name: /review order policy/i }),
    ).toBeVisible();
    await expect(page.getByText(/support@estore.example.com/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /confirm and place order/i }),
    ).toBeDisabled();
    expect(checkoutRequests).toBe(0);

    await page.getByRole("checkbox").check();
    await expect(
      page.getByRole("button", { name: /confirm and place order/i }),
    ).toBeEnabled();

    await page
      .getByRole("button", { name: /confirm and place order/i })
      .click();
    await expect(page).toHaveURL(/\/orders$/);
    expect(checkoutRequests).toBe(1);
  });
});
