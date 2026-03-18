import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { Cart, AddToCartInput } from "@/lib/types";
import { apiClient, ApiError } from "@/lib/api-client";

interface CartState {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
}

const initialState: CartState = {
  cart: null,
  loading: false,
  error: null,
};

export const fetchCart = createAsyncThunk("cart/fetchCart", async () => {
  const data = await apiClient.get<{ cart: Cart | null }>("/api/cart");
  return data.cart;
});

export const addToCart = createAsyncThunk(
  "cart/addToCart",
  async (input: AddToCartInput, { rejectWithValue }) => {
    try {
      const data = await apiClient.post<{ cart: Cart }>("/api/cart", input);
      return data.cart;
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
      return dispatch(fetchCart()).unwrap();
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
      return dispatch(fetchCart()).unwrap();
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
        state.cart = action.payload;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch cart";
      });

    // addToCart
    builder
      .addCase(addToCart.fulfilled, (state, action) => {
        state.cart = action.payload;
        state.error = null;
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.error = (action.payload as string) || "Failed to add to cart";
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
        state.error = null;
      })
      .addCase(clearCart.rejected, (state, action) => {
        state.error = (action.payload as string) || "Failed to clear cart";
      });
  },
});

export const { clearError } = cartSlice.actions;

// Selectors
export const selectCart = (state: { cart: CartState }) => state.cart.cart;
export const selectCartLoading = (state: { cart: CartState }) =>
  state.cart.loading;
export const selectCartError = (state: { cart: CartState }) => state.cart.error;
export const selectCartItemCount = (state: { cart: CartState }) => {
  const cart = state.cart.cart;
  if (!cart?.items) return 0;
  return cart.items.reduce((total, item) => total + item.quantity, 0);
};

export default cartSlice.reducer;
