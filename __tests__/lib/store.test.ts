import { describe, it, expect } from "vitest";
import { makeStore } from "@/lib/store";

describe("Redux store", () => {
  it("creates a store with correct slices", () => {
    const store = makeStore();
    const state = store.getState();
    expect(state).toHaveProperty("cart");
    expect(state).toHaveProperty("orders");
    expect(state).toHaveProperty("admin");
  });

  it("cart initial state", () => {
    const store = makeStore();
    expect(store.getState().cart).toEqual({
      cart: null,
      loading: false,
      error: null,
      stockWarning: null,
      adjustedQuantity: null,
    });
  });

  it("orders initial state", () => {
    const store = makeStore();
    expect(store.getState().orders).toEqual({
      orders: [],
      currentOrder: null,
      loading: false,
      detailLoading: false,
      cancelling: false,
      error: null,
    });
  });

  it("admin initial state", () => {
    const store = makeStore();
    expect(store.getState().admin).toEqual({
      products: [],
      orders: [],
      users: [],
      productsLoading: false,
      ordersLoading: false,
      usersLoading: false,
      error: null,
    });
  });

  it("creates independent store instances", () => {
    const store1 = makeStore();
    const store2 = makeStore();
    expect(store1).not.toBe(store2);
  });
});
