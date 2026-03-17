import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Product } from "@/lib/types";

interface WishlistState {
  productIds: string[];
  products: Product[];
  loading: boolean;
  error: string | null;
}

const initialState: WishlistState = {
  productIds: [],
  products: [],
  loading: false,
  error: null,
};

export const fetchWishlist = createAsyncThunk(
  "wishlist/fetchWishlist",
  async (_, { rejectWithValue }) => {
    const res = await fetch("/api/wishlist");
    if (!res.ok) {
      if (res.status === 401) return { products: [], productIds: [] };
      const data = await res.json().catch(() => ({}));
      return rejectWithValue(data.error || "Failed to fetch wishlist");
    }
    const data = await res.json();
    return {
      products: (data.data?.products ?? []) as Product[],
      productIds: (data.data?.productIds ?? []) as string[],
    };
  },
);

export const addToWishlist = createAsyncThunk(
  "wishlist/addToWishlist",
  async (productId: string, { rejectWithValue }) => {
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return rejectWithValue(data.error || "Failed to add to wishlist");
    }
    return productId;
  },
);

export const removeFromWishlist = createAsyncThunk(
  "wishlist/removeFromWishlist",
  async (productId: string, { rejectWithValue }) => {
    const res = await fetch(`/api/wishlist/${productId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return rejectWithValue(data.error || "Failed to remove from wishlist");
    }
    return productId;
  },
);

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    // Optimistic toggle: add or remove productId locally before API responds
    optimisticToggle: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (state.productIds.includes(id)) {
        state.productIds = state.productIds.filter((pid) => pid !== id);
        state.products = state.products.filter((p) => p.id !== id);
      } else {
        state.productIds.push(id);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.products;
        state.productIds = action.payload.productIds;
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(addToWishlist.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(removeFromWishlist.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { optimisticToggle } = wishlistSlice.actions;
export default wishlistSlice.reducer;
