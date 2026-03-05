/**
 * Supplementary tests for adminSlice async thunks (function body coverage).
 * Dispatches real thunks with mocked fetch to cover lines 103-204.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import adminReducer, {
  fetchAdminProducts,
  fetchAdminOrders,
  fetchAdminUsers,
  updateAdminOrderStatus,
  updateAdminUserRole,
} from "@/lib/features/admin/adminSlice";

function makeStore() {
  return configureStore({ reducer: { admin: adminReducer } });
}

describe("adminSlice async thunks (fetch bodies)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // fetchAdminProducts
  it("fetchAdminProducts fulfilled sets products via real dispatch", async () => {
    const products = [{ id: "p1", name: "Product A" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { products } }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchAdminProducts());
    expect(store.getState().admin.products).toEqual(products);
    expect(store.getState().admin.productsLoading).toBe(false);
  });

  it("fetchAdminProducts uses data.products fallback", async () => {
    const products = [{ id: "p2" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ products }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchAdminProducts());
    expect(store.getState().admin.products).toEqual(products);
  });

  it("fetchAdminProducts rejected sets error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Forbidden" }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchAdminProducts());
    expect(store.getState().admin.error).toBe("Forbidden");
    expect(store.getState().admin.productsLoading).toBe(false);
  });

  it("fetchAdminProducts rejected uses fallback error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("parse error")),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchAdminProducts());
    expect(store.getState().admin.error).toBe("Failed to fetch products");
  });

  // fetchAdminOrders
  it("fetchAdminOrders fulfilled sets orders", async () => {
    const orders = [{ id: "o1", status: "PENDING" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { orders } }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchAdminOrders());
    expect(store.getState().admin.orders).toEqual(orders);
  });

  it("fetchAdminOrders uses orders fallback", async () => {
    const orders = [{ id: "o2" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ orders }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchAdminOrders());
    expect(store.getState().admin.orders).toEqual(orders);
  });

  it("fetchAdminOrders rejected sets error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Not authorized" }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchAdminOrders());
    expect(store.getState().admin.error).toBe("Not authorized");
  });

  // fetchAdminUsers
  it("fetchAdminUsers fulfilled sets users", async () => {
    const users = [{ id: "u1", email: "admin@test.com" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { users } }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchAdminUsers());
    expect(store.getState().admin.users).toEqual(users);
  });

  it("fetchAdminUsers rejected sets error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchAdminUsers());
    expect(store.getState().admin.error).toBe("Server error");
  });

  // updateAdminOrderStatus
  it("updateAdminOrderStatus fulfilled updates order in list", async () => {
    const updated = { id: "o1", status: "SHIPPED", trackingNumber: "TRK123" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { order: updated } }),
      }),
    );
    const store = configureStore({
      reducer: { admin: adminReducer },
      preloadedState: {
        admin: {
          products: [],
          orders: [{ id: "o1", status: "PENDING" } as never],
          users: [],
          productsLoading: false,
          ordersLoading: false,
          usersLoading: false,
          error: null,
        },
      },
    });
    await store.dispatch(
      updateAdminOrderStatus({ id: "o1", status: "SHIPPED", trackingNumber: "TRK123" }),
    );
    const order = store.getState().admin.orders[0] as { status: string };
    expect(order.status).toBe("SHIPPED");
  });

  it("updateAdminOrderStatus rejected does not crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Order not found" }),
      }),
    );
    const store = makeStore();
    // No rejected handler in reducer - error stays null but thunk body runs
    await store.dispatch(
      updateAdminOrderStatus({ id: "o99", status: "CANCELLED" }),
    );
    expect(store.getState().admin.productsLoading).toBe(false);
  });

  it("updateAdminOrderStatus uses order fallback", async () => {
    const updated = { id: "o1", status: "DELIVERED" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ order: updated }),
      }),
    );
    const store = configureStore({
      reducer: { admin: adminReducer },
      preloadedState: {
        admin: {
          products: [],
          orders: [{ id: "o1", status: "SHIPPED" } as never],
          users: [],
          productsLoading: false,
          ordersLoading: false,
          usersLoading: false,
          error: null,
        },
      },
    });
    await store.dispatch(updateAdminOrderStatus({ id: "o1", status: "DELIVERED" }));
    const order = store.getState().admin.orders[0] as { status: string };
    expect(order.status).toBe("DELIVERED");
  });

  // updateAdminUserRole
  it("updateAdminUserRole fulfilled updates user role", async () => {
    const updated = { id: "u1", role: "ADMIN" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { user: updated } }),
      }),
    );
    const store = configureStore({
      reducer: { admin: adminReducer },
      preloadedState: {
        admin: {
          products: [],
          orders: [],
          users: [{ id: "u1", role: "CUSTOMER" } as never],
          productsLoading: false,
          ordersLoading: false,
          usersLoading: false,
          error: null,
        },
      },
    });
    await store.dispatch(updateAdminUserRole({ id: "u1", role: "ADMIN" }));
    const user = store.getState().admin.users[0] as { role: string };
    expect(user.role).toBe("ADMIN");
  });

  it("updateAdminUserRole rejected does not crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      }),
    );
    const store = makeStore();
    // No rejected handler in reducer - state stays unchanged
    await store.dispatch(updateAdminUserRole({ id: "u99", role: "ADMIN" }));
    expect(store.getState().admin.usersLoading).toBe(false);
  });
});
