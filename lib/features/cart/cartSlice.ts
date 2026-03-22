import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { Cart, AddToCartInput } from "@/lib/types";
import { apiClient, ApiError } from "@/lib/api-client";

interface AddToCartResponse {
  cart: Cart;
  warning?: string;
  adjustedQuantity?: number;
}

interface CartState {
  cart: Cart | null;
  loading: boolean;
  lastFetchedAt: number | null;
  error: string | null;
  stockWarning: string | null;
  adjustedQuantity: number | null;
}

const CART_REFRESH_TTL_MS = 60_000;

const initialState: CartState = {
  cart: null,
  loading: false,
  lastFetchedAt: null,
  error: null,
  stockWarning: null,
  adjustedQuantity: null,
};

export const fetchCart = createAsyncThunk(
  "cart/fetchCart",
  async (options?: { force?: boolean }) => {
    const data = await apiClient.get<{ cart: Cart | null }>("/api/cart");
    return data.cart;
  },
  {
    condition: (options, { getState }) => {
      const state = (getState() as { cart: CartState }).cart;
      if (state.loading) {
        return false;
      }

      const force = options?.force ?? false;
      if (force || state.lastFetchedAt === null) {
        return true;
      }

      return Date.now() - state.lastFetchedAt >= CART_REFRESH_TTL_MS;
    },
  },
);

export const addToCart = createAsyncThunk(
  "cart/addToCart",
  async (input: AddToCartInput, { rejectWithValue }) => {
    try {
      const data = await apiClient.post<AddToCartResponse>("/api/cart", input);
      return data;
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to add to cart");
    }
  },
);

export const updateCartItem = createAsyncThunk(
  "cart/updateCartItem",
  async (
    { itemId, quantity }: { itemId: string; quantity: number },
    { dispatch, rejectWithValue },
  ) => {
    try {
      await apiClient.patch(`/api/cart/items/${itemId}`, { quantity });
      return dispatch(fetchCart({ force: true })).unwrap();
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to update item");
    }
  },
);

export const removeCartItem = createAsyncThunk(
  "cart/removeCartItem",
  async (itemId: string, { dispatch, rejectWithValue }) => {
    try {
      await apiClient.delete(`/api/cart/items/${itemId}`);
      return dispatch(fetchCart({ force: true })).unwrap();
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to remove item");
    }
  },
);

export const clearCart = createAsyncThunk(
  "cart/clearCart",
  async (_, { rejectWithValue }) => {
    try {
      await apiClient.delete("/api/cart");
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to clear cart");
    }
  },
);

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    clearStockWarning(state) {
      state.stockWarning = null;
      state.adjustedQuantity = null;
    },
  },
  extraReducers: (builder) => {
    // fetchCart
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false;
        state.lastFetchedAt = Date.now();
        state.cart = action.payload;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch cart";
      });

    // addToCart
    builder
      .addCase(addToCart.fulfilled, (state, action) => {
        state.cart = action.payload.cart;
        state.lastFetchedAt = Date.now();
        state.error = null;
        state.stockWarning = action.payload.warning ?? null;
        state.adjustedQuantity = action.payload.adjustedQuantity ?? null;
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.error = (action.payload as string) || "Failed to add to cart";
        state.stockWarning = null;
        state.adjustedQuantity = null;
      });

    // updateCartItem
    builder
      .addCase(updateCartItem.fulfilled, (state, action) => {
        state.cart = action.payload;
        state.error = null;
      })
      .addCase(updateCartItem.rejected, (state, action) => {
        state.error = (action.payload as string) || "Failed to update item";
      });

    // removeCartItem
    builder
      .addCase(removeCartItem.fulfilled, (state, action) => {
        state.cart = action.payload;
        state.error = null;
      })
      .addCase(removeCartItem.rejected, (state, action) => {
        state.error = (action.payload as string) || "Failed to remove item";
      });

    // clearCart
    builder
      .addCase(clearCart.fulfilled, (state) => {
        state.cart = null;
        state.lastFetchedAt = Date.now();
        state.error = null;
      })
      .addCase(clearCart.rejected, (state, action) => {
        state.error = (action.payload as string) || "Failed to clear cart";
      });
  },
});

export const { clearError, clearStockWarning } = cartSlice.actions;

// Selectors
export const selectCart = (state: { cart: CartState }) => state.cart.cart;
export const selectCartLoading = (state: { cart: CartState }) =>
  state.cart.loading;
export const selectCartError = (state: { cart: CartState }) => state.cart.error;
export const selectStockWarning = (state: { cart: CartState }) =>
  state.cart.stockWarning;
export const selectAdjustedQuantity = (state: { cart: CartState }) =>
  state.cart.adjustedQuantity;
export const selectCartItemCount = (state: { cart: CartState }) => {
  const cart = state.cart.cart;
  if (!cart?.items) return 0;
  return cart.items.reduce((total, item) => total + item.quantity, 0);
};

export default cartSlice.reducer;
