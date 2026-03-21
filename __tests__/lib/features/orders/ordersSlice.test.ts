import { describe, it, expect } from "vitest";
import ordersReducer, {
  clearOrderError,
  clearCurrentOrder,
  selectOrders,
  selectOrdersLoading,
  selectOrdersError,
  selectCurrentOrder,
  selectOrderDetailLoading,
  selectOrderCancelling,
} from "@/lib/features/orders/ordersSlice";

const initialState = {
  orders: [],
  currentOrder: null,
  loading: false,
  detailLoading: false,
  cancelling: false,
  error: null,
};

describe("ordersSlice reducer", () => {
  it("returns initial state", () => {
    expect(ordersReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("clearOrderError sets error to null", () => {
    const state = { ...initialState, error: "Something went wrong" };
    expect(ordersReducer(state, clearOrderError()).error).toBeNull();
  });

  it("clearCurrentOrder sets currentOrder to null", () => {
    const state = { ...initialState, currentOrder: { id: "o1" } as never };
    expect(ordersReducer(state, clearCurrentOrder()).currentOrder).toBeNull();
  });
});

describe("ordersSlice extraReducers", () => {
  it("sets loading on fetchOrders.pending", () => {
    const result = ordersReducer(initialState, {
      type: "orders/fetchOrders/pending",
    });
    expect(result.loading).toBe(true);
    expect(result.error).toBeNull();
  });

  it("sets orders on fetchOrders.fulfilled", () => {
    const orders = [{ id: "o1", status: "PENDING" }];
    const result = ordersReducer(initialState, {
      type: "orders/fetchOrders/fulfilled",
      payload: orders,
    });
    expect(result.loading).toBe(false);
    expect(result.orders).toEqual(orders);
  });

  it("sets error on fetchOrders.rejected", () => {
    const result = ordersReducer(initialState, {
      type: "orders/fetchOrders/rejected",
      payload: "Auth required",
    });
    expect(result.loading).toBe(false);
    expect(result.error).toBe("Auth required");
  });

  it("sets detailLoading on fetchOrderById.pending", () => {
    const result = ordersReducer(initialState, {
      type: "orders/fetchOrderById/pending",
    });
    expect(result.detailLoading).toBe(true);
  });

  it("sets currentOrder on fetchOrderById.fulfilled", () => {
    const order = { id: "o1", status: "PENDING", items: [] };
    const result = ordersReducer(initialState, {
      type: "orders/fetchOrderById/fulfilled",
      payload: order,
    });
    expect(result.detailLoading).toBe(false);
    expect(result.currentOrder).toEqual(order);
  });

  it("sets cancelling on cancelOrder.pending", () => {
    const result = ordersReducer(initialState, {
      type: "orders/cancelOrder/pending",
    });
    expect(result.cancelling).toBe(true);
    expect(result.error).toBeNull();
  });

  it("updates currentOrder and order list on cancelOrder.fulfilled", () => {
    const cancelled = { id: "o1", status: "CANCELLED" };
    const state = {
      ...initialState,
      orders: [{ id: "o1", status: "PENDING" }] as never[],
      currentOrder: { id: "o1", status: "PENDING" } as never,
    };
    const result = ordersReducer(state, {
      type: "orders/cancelOrder/fulfilled",
      payload: cancelled,
    });
    expect(result.cancelling).toBe(false);
    expect(result.currentOrder).toEqual(cancelled);
    expect(result.orders[0]).toEqual(cancelled);
  });

  it("sets error on cancelOrder.rejected", () => {
    const result = ordersReducer(initialState, {
      type: "orders/cancelOrder/rejected",
      payload: "Cannot cancel SHIPPED order",
    });
    expect(result.cancelling).toBe(false);
    expect(result.error).toBe("Cannot cancel SHIPPED order");
  });
});

describe("orders selectors", () => {
  const rootState = {
    cart: {} as never,
    wishlist: {} as never,
    orders: {
      ...initialState,
      orders: [{ id: "o1" }] as never[],
      currentOrder: { id: "o1" } as never,
      loading: true,
      detailLoading: true,
      cancelling: true,
      error: "err",
    },
    admin: {} as never,
  };

  it("selectOrders", () => {
    expect(selectOrders(rootState)).toEqual([{ id: "o1" }]);
  });

  it("selectOrdersLoading", () => {
    expect(selectOrdersLoading(rootState)).toBe(true);
  });

  it("selectOrdersError", () => {
    expect(selectOrdersError(rootState)).toBe("err");
  });

  it("selectCurrentOrder", () => {
    expect(selectCurrentOrder(rootState)).toEqual({ id: "o1" });
  });

  it("selectOrderDetailLoading", () => {
    expect(selectOrderDetailLoading(rootState)).toBe(true);
  });

  it("selectOrderCancelling", () => {
    expect(selectOrderCancelling(rootState)).toBe(true);
  });
});
