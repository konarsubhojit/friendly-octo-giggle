/**
 * Comprehensive E2E tests for the Shopping Cart page.
 *
 * All API calls are intercepted with Playwright route mocks so the tests
 * are fully deterministic and require no live database or Redis instance.
 *
 * Key regression test: after a quantity update (+ or -) the cart items must
 * remain visible.  Previously the PATCH handler returned { success: true }
 * (no cart payload) and the Redux reducer set state.cart to undefined, which
 * caused the empty-cart state to flash on the page.
 */
import { test, expect, Page } from '@playwright/test';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  MOCK_CART,
  MOCK_CART_ITEM_1,
  MOCK_CART_ITEM_2,
} from './mock-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = join(__dirname, 'screenshots');

const screenshotPath = (name: string): string => join(SCREENSHOT_DIR, `${name}.png`);

test.beforeAll(() => {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

// ─── Route mock helpers ───────────────────────────────────────────────────────

type CartState = { current: typeof MOCK_CART | null };

/** Apply an in-memory quantity update to the mock cart state. */
const applyQuantityUpdate = (cartState: CartState, url: string, rawBody: string | null): void => {
  if (!cartState.current) return;
  const body = rawBody ? (JSON.parse(rawBody) as { quantity: number }) : null;
  cartState.current = {
    ...cartState.current,
    items: cartState.current.items.map((item) =>
      url.endsWith(item.id) && body ? { ...item, quantity: body.quantity } : item,
    ),
  };
};

/** Apply an in-memory item removal to the mock cart state. */
const applyItemRemoval = (cartState: CartState, url: string): void => {
  if (!cartState.current) return;
  cartState.current = {
    ...cartState.current,
    items: cartState.current.items.filter((item) => !url.endsWith(item.id)),
  };
};

/** Suppress exchange-rate 500s caused by Redis/DB not being available. */
const mockExchangeRates = async (page: Page): Promise<void> => {
  await page.route('**/api/exchange-rates**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 } },
      },
    }),
  );
};

/**
 * Set up stateful cart route mocks.
 *
 * `cartState` is a mutable reference object so individual tests can mutate it
 * and the GET handler always serves the latest state (simulating what the real
 * server would do after a PATCH/DELETE).
 */
const mockCartRoutes = async (page: Page, cartState: CartState): Promise<void> => {
  await mockExchangeRates(page);

  // GET /api/cart — serve current state
  await page.route('**/api/cart', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ json: { cart: cartState.current } });
  });

  // PATCH or DELETE /api/cart/items/:id — mutate state, return { success: true }
  await page.route('**/api/cart/items/**', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      applyQuantityUpdate(cartState, route.request().url(), route.request().postData());
      await route.fulfill({ json: { success: true } });
    } else if (method === 'DELETE') {
      applyItemRemoval(cartState, route.request().url());
      await route.fulfill({ json: { success: true } });
    } else {
      await route.continue();
    }
  });

  // POST /api/orders — accept order placement
  await page.route('**/api/orders**', (route) =>
    route.fulfill({
      json: { success: true, data: { order: { id: 'ord-test-001' } } },
      status: 201,
    }),
  );
};

// ─── Cart loading & display ───────────────────────────────────────────────────

test.describe('Cart page – loading and display', () => {
  test('renders cart items when cart has items', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    await expect(page.getByText(MOCK_CART_ITEM_1.product.name)).toBeVisible();
    await expect(page.getByText(MOCK_CART_ITEM_2.product.name)).toBeVisible();

    await page.screenshot({ path: screenshotPath('cart-with-items') });
  });

  test('shows "Shopping Cart" heading', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    await expect(page.getByRole('heading', { name: /shopping cart/i })).toBeVisible();
  });

  test('shows Order Summary sidebar', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    await expect(page.getByRole('heading', { name: /order summary/i })).toBeVisible();
    await expect(page.getByText(/shipping/i)).toBeVisible();
  });

  test('shows empty cart state when cart has no items', async ({ page }) => {
    const cartState: { current: typeof MOCK_CART | null } = {
      current: { ...MOCK_CART, items: [] },
    };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
    await expect(page.getByText(/browse products/i)).toBeVisible();

    await page.screenshot({ path: screenshotPath('cart-empty') });
  });

  test('shows empty cart state when cart is null', async ({ page }) => {
    const cartState: { current: typeof MOCK_CART | null } = { current: null };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });
});

// ─── Quantity updates (regression for the bug) ────────────────────────────────

test.describe('Cart page – quantity updates', () => {
  test('increase quantity keeps cart items visible', async ({ page }) => {
    const cartState = {
      current: {
        ...MOCK_CART,
        items: [{ ...MOCK_CART_ITEM_1, quantity: 2 }],
      },
    };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');
    await expect(page.getByText(MOCK_CART_ITEM_1.product.name)).toBeVisible();

    // Click the + button
    const increaseBtn = page.getByRole('button', { name: '+' }).first();
    await increaseBtn.click();

    // Cart items must still be visible — NOT the empty state
    await expect(page.getByText(/your cart is empty/i)).not.toBeVisible();
    await expect(page.getByText(MOCK_CART_ITEM_1.product.name)).toBeVisible();

    // Quantity should update to 3
    await expect(page.getByText('3')).toBeVisible();

    await page.screenshot({ path: screenshotPath('cart-quantity-increased') });
  });

  test('decrease quantity keeps cart items visible', async ({ page }) => {
    const cartState = {
      current: {
        ...MOCK_CART,
        items: [{ ...MOCK_CART_ITEM_1, quantity: 3 }],
      },
    };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');
    await expect(page.getByText(MOCK_CART_ITEM_1.product.name)).toBeVisible();

    // Click the - button
    const decreaseBtn = page.getByRole('button', { name: '-' }).first();
    await decreaseBtn.click();

    // Cart items must still be visible — NOT the empty state
    await expect(page.getByText(/your cart is empty/i)).not.toBeVisible();
    await expect(page.getByText(MOCK_CART_ITEM_1.product.name)).toBeVisible();

    // Quantity should update to 2
    await expect(page.getByText('2')).toBeVisible();

    await page.screenshot({ path: screenshotPath('cart-quantity-decreased') });
  });

  test('- button is disabled when quantity is 1', async ({ page }) => {
    const cartState = {
      current: {
        ...MOCK_CART,
        items: [{ ...MOCK_CART_ITEM_1, quantity: 1 }],
      },
    };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    const decreaseBtn = page.getByRole('button', { name: '-' }).first();
    await expect(decreaseBtn).toBeDisabled();
  });

  test('updating quantity with multiple items preserves all cart items', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    // Both items should be visible before
    await expect(page.getByText(MOCK_CART_ITEM_1.product.name)).toBeVisible();
    await expect(page.getByText(MOCK_CART_ITEM_2.product.name)).toBeVisible();

    // Increase quantity of first item
    const increaseBtn = page.getByRole('button', { name: '+' }).first();
    await increaseBtn.click();

    // Both items should still be visible after the update
    await expect(page.getByText(/your cart is empty/i)).not.toBeVisible();
    await expect(page.getByText(MOCK_CART_ITEM_1.product.name)).toBeVisible();
    await expect(page.getByText(MOCK_CART_ITEM_2.product.name)).toBeVisible();
  });
});

// ─── Remove item ──────────────────────────────────────────────────────────────

test.describe('Cart page – remove item', () => {
  test('removing one item leaves remaining items visible', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    await expect(page.getByText(MOCK_CART_ITEM_1.product.name)).toBeVisible();
    await expect(page.getByText(MOCK_CART_ITEM_2.product.name)).toBeVisible();

    // Remove the first item
    const removeButtons = page.getByRole('button', { name: /remove/i });
    await removeButtons.first().click();

    // The second item must remain visible
    await expect(page.getByText(MOCK_CART_ITEM_2.product.name)).toBeVisible();

    await page.screenshot({ path: screenshotPath('cart-item-removed') });
  });

  test('removing the last item shows empty cart state', async ({ page }) => {
    const cartState = {
      current: {
        ...MOCK_CART,
        items: [{ ...MOCK_CART_ITEM_1 }],
      },
    };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');
    await expect(page.getByText(MOCK_CART_ITEM_1.product.name)).toBeVisible();

    // Remove the only item
    await page.getByRole('button', { name: /remove/i }).click();

    // Empty cart state should appear
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
    await expect(page.getByText(/browse products/i)).toBeVisible();

    await page.screenshot({ path: screenshotPath('cart-all-items-removed') });
  });
});

// ─── Order summary ────────────────────────────────────────────────────────────

test.describe('Cart page – order summary', () => {
  test('order summary shows correct item count and free shipping', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    // Derive total quantity directly from the mock state to stay resilient to data changes
    const totalQty = MOCK_CART.items.reduce((sum, item) => sum + item.quantity, 0);
    await expect(page.getByText(new RegExp(`${totalQty} items`))).toBeVisible();

    // Shipping is free
    await expect(page.getByText(/free/i)).toBeVisible();
  });

  test('order summary total updates after quantity increase', async ({ page }) => {
    const cartState = {
      current: {
        ...MOCK_CART,
        items: [{ ...MOCK_CART_ITEM_1, quantity: 1 }, { ...MOCK_CART_ITEM_2 }],
      },
    };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    // Increase quantity of first item
    await page.getByRole('button', { name: '+' }).first().click();

    // Item count in summary should now reflect 2 + 1 = 3 items
    await expect(page.getByText(/3 items/)).toBeVisible();
  });

  test('place order button renders and shipping address field is present', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    await expect(page.getByRole('button', { name: /place order/i })).toBeVisible();
    await expect(page.getByLabel(/shipping address/i)).toBeVisible();
  });

  test('place order validation requires shipping address', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    // Submit without filling address
    await page.getByRole('button', { name: /place order/i }).click();

    // Validation error should appear
    await expect(
      page.getByText(/please enter a shipping address/i),
    ).toBeVisible();
  });

  test('successfully places order with valid shipping address', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    await page.getByLabel(/shipping address/i).fill('42 MG Road, Bengaluru, Karnataka 560001');
    await page.getByRole('button', { name: /place order/i }).click();

    // Success banner should appear
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({
      timeout: 5000,
    });

    await page.screenshot({ path: screenshotPath('cart-order-placed') });
  });
});

// ─── Navigation ───────────────────────────────────────────────────────────────

test.describe('Cart page – navigation', () => {
  test('"Continue Shopping" link navigates back to home', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    const continueLink = page.getByRole('link', { name: /continue shopping/i });
    await expect(continueLink).toBeVisible();
    await expect(continueLink).toHaveAttribute('href', '/');
  });

  test('"Browse Products" link in empty cart navigates to home', async ({ page }) => {
    const cartState: { current: typeof MOCK_CART | null } = {
      current: { ...MOCK_CART, items: [] },
    };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    const browseLink = page.getByRole('link', { name: /browse products/i });
    await expect(browseLink).toBeVisible();
    await expect(browseLink).toHaveAttribute('href', '/');
  });

  test('product name in cart item links to product page', async ({ page }) => {
    const cartState = { current: { ...MOCK_CART } };
    await mockCartRoutes(page, cartState);

    await page.goto('/cart');

    const productLink = page.getByRole('link', {
      name: MOCK_CART_ITEM_1.product.name,
    });
    await expect(productLink).toBeVisible();
    await expect(productLink).toHaveAttribute(
      'href',
      `/products/${MOCK_CART_ITEM_1.productId}`,
    );
  });
});
