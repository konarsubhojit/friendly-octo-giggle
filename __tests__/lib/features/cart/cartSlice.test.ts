import { describe, it, expect } from "vitest";
import cartReducer, {
  clearError,
  selectCart,
  selectCartLoading,
  selectCartError,
  selectCartItemCount,
} from "@/lib/features/cart/cartSlice";

const initialState = {
  cart: null,
  loading: false,
  error: null,
};

describe("cartSlice reducer", () => {
  it("returns initial state", () => {
    expect(cartReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("clearError sets error to null", () => {
    const state = { ...initialState, error: "Some error" };
    expect(cartReducer(state, clearError()).error).toBeNull();
  });
});

describe("cartSlice extraReducers", () => {
  it("sets loading on fetchCart.pending", () => {
    const result = cartReducer(initialState, {
      type: "cart/fetchCart/pending",
    });
    expect(result.loading).toBe(true);
    expect(result.error).toBeNull();
  });

  it("sets cart on fetchCart.fulfilled", () => {
    const cart = { id: "cart-1", items: [], userId: "u1" };
    const result = cartReducer(initialState, {
      type: "cart/fetchCart/fulfilled",
      payload: cart,
    });
    expect(result.loading).toBe(false);
    expect(result.cart).toEqual(cart);
  });

  it("sets error on fetchCart.rejected", () => {
    const result = cartReducer(initialState, {
      type: "cart/fetchCart/rejected",
      error: { message: "Network error" },
    });
    expect(result.loading).toBe(false);
    expect(result.error).toBe("Network error");
  });

  it("updates cart on addToCart.fulfilled", () => {
    const cart = { id: "cart-1", items: [{ id: "item-1", quantity: 2 }] };
    const result = cartReducer(initialState, {
      type: "cart/addToCart/fulfilled",
      payload: cart,
    });
    expect(result.cart).toEqual(cart);
    expect(result.error).toBeNull();
  });

  it("sets error on addToCart.rejected", () => {
    const result = cartReducer(initialState, {
      type: "cart/addToCart/rejected",
      payload: "Out of stock",
    });
    expect(result.error).toBe("Out of stock");
  });

  it("updates cart on updateCartItem.fulfilled", () => {
    const cart = { id: "cart-1", items: [] };
    const result = cartReducer(initialState, {
      type: "cart/updateCartItem/fulfilled",
      payload: cart,
    });
    expect(result.cart).toEqual(cart);
  });

  it("clears cart on clearCart.fulfilled", () => {
    const state = {
      ...initialState,
      cart: { id: "cart-1", items: [] } as never,
    };
    const result = cartReducer(state, { type: "cart/clearCart/fulfilled" });
    expect(result.cart).toBeNull();
  });
});

describe("cart selectors", () => {
  it("selectCart returns cart", () => {
    const state = { cart: { ...initialState, cart: { id: "1" } as never } };
    expect(selectCart(state)).toEqual({ id: "1" });
  });

  it("selectCartLoading returns loading", () => {
    const state = { cart: { ...initialState, loading: true } };
    expect(selectCartLoading(state)).toBe(true);
  });

  it("selectCartError returns error", () => {
    const state = { cart: { ...initialState, error: "fail" } };
    expect(selectCartError(state)).toBe("fail");
  });

  it("selectCartItemCount returns 0 for null cart", () => {
    const state = { cart: initialState };
    expect(selectCartItemCount(state)).toBe(0);
  });

  it("selectCartItemCount sums item quantities", () => {
    const state = {
      cart: {
        ...initialState,
        cart: {
          id: "1",
          items: [
            { id: "a", quantity: 3 },
            { id: "b", quantity: 2 },
          ],
        } as never,
      },
    };
    expect(selectCartItemCount(state)).toBe(5);
  });

  it("selectCartItemCount returns 0 for empty items", () => {
    const state = {
      cart: { ...initialState, cart: { id: "1", items: [] } as never },
    };
    expect(selectCartItemCount(state)).toBe(0);
  });
});
