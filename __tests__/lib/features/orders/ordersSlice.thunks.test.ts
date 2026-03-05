/**
 * Supplementary tests for ordersSlice async thunks (function body coverage).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import ordersReducer, {
  fetchOrders,
  fetchOrderById,
  cancelOrder,
} from "@/lib/features/orders/ordersSlice";

function makeStore() {
  return configureStore({ reducer: { orders: ordersReducer } });
}

const mockOrder = {
  id: "o1",
  customerName: "Alice",
  customerEmail: "alice@test.com",
  customerAddress: "123 Main St",
  totalAmount: 100,
  status: "PENDING",
  items: [],
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

describe("ordersSlice async thunks (fetch bodies)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // fetchOrders
  it("fetchOrders fulfilled sets orders (data.orders format)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ orders: [mockOrder] }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchOrders());
    expect(store.getState().orders.orders).toEqual([mockOrder]);
    expect(store.getState().orders.loading).toBe(false);
  });

  it("fetchOrders fulfilled uses data.data.orders fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { orders: [mockOrder] } }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchOrders());
    expect(store.getState().orders.orders).toEqual([mockOrder]);
  });

  it("fetchOrders fulfilled returns empty array as fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchOrders());
    expect(store.getState().orders.orders).toEqual([]);
  });

  it("fetchOrders rejected on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchOrders());
    expect(store.getState().orders.error).toBe("Unauthorized");
  });

  it("fetchOrders rejected uses fallback error when JSON parse fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("parse error")),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchOrders());
    expect(store.getState().orders.error).toBe("Failed to fetch orders");
  });

  // fetchOrderById
  it("fetchOrderById fulfilled sets currentOrder (data.order)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ order: mockOrder }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchOrderById("o1"));
    expect(store.getState().orders.currentOrder).toEqual(mockOrder);
  });

  it("fetchOrderById fulfilled uses data.data.order fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { order: mockOrder } }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchOrderById("o1"));
    expect(store.getState().orders.currentOrder).toEqual(mockOrder);
  });

  it("fetchOrderById rejected on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Order not found" }),
      }),
    );
    const store = makeStore();
    await store.dispatch(fetchOrderById("bad-id"));
    expect(store.getState().orders.error).toBe("Order not found");
  });

  // cancelOrder
  it("cancelOrder fulfilled updates currentOrder", async () => {
    const cancelled = { ...mockOrder, status: "CANCELLED" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ order: cancelled }),
      }),
    );
    const store = configureStore({
      reducer: { orders: ordersReducer },
      preloadedState: {
        orders: {
          orders: [mockOrder],
          currentOrder: mockOrder,
          loading: false,
          detailLoading: false,
          cancelling: false,
          error: null,
        },
      },
    });
    await store.dispatch(cancelOrder("o1"));
    expect(store.getState().orders.currentOrder?.status).toBe("CANCELLED");
    expect(store.getState().orders.cancelling).toBe(false);
  });

  it("cancelOrder rejected sets error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Cannot cancel" }),
      }),
    );
    const store = makeStore();
    await store.dispatch(cancelOrder("o1"));
    expect(store.getState().orders.error).toBe("Cannot cancel");
  });

  it("cancelOrder rejected uses fallback message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("parse error")),
      }),
    );
    const store = makeStore();
    await store.dispatch(cancelOrder("o1"));
    expect(store.getState().orders.error).toBe("Failed to cancel order");
  });

  it("cancelOrder fulfilled uses data.data.order fallback", async () => {
    const cancelled = { ...mockOrder, status: "CANCELLED" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { order: cancelled } }),
      }),
    );
    const store = configureStore({
      reducer: { orders: ordersReducer },
      preloadedState: {
        orders: {
          orders: [mockOrder],
          currentOrder: mockOrder,
          loading: false,
          detailLoading: false,
          cancelling: false,
          error: null,
        },
      },
    });
    await store.dispatch(cancelOrder("o1"));
    expect(store.getState().orders.currentOrder?.status).toBe("CANCELLED");
  });
});
