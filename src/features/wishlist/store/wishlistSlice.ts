import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Product } from "@/lib/types";
import { apiClient, ApiError } from "@/lib/api-client";

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
    try {
      const data = await apiClient.get<{
        data?: { products?: Product[]; productIds?: string[] };
      }>("/api/wishlist");
      return {
        products: data.data?.products ?? [],
        productIds: data.data?.productIds ?? [],
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return { products: [], productIds: [] };
      }
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to fetch wishlist");
    }
  },
);

export const addToWishlist = createAsyncThunk(
  "wishlist/addToWishlist",
  async (productId: string, { rejectWithValue }) => {
    try {
      await apiClient.post("/api/wishlist", { productId });
      return productId;
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to add to wishlist");
    }
  },
);

export const removeFromWishlist = createAsyncThunk(
  "wishlist/removeFromWishlist",
  async (productId: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/api/wishlist/${productId}`);
      return productId;
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to remove from wishlist");
    }
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
