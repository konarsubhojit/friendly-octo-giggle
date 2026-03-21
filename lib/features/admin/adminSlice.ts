import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "@/lib/store";
import { apiClient, ApiError } from "@/lib/api-client";

// Admin-scoped types
interface AdminProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  stock: number;
  category: string;
  createdAt: string;
  updatedAt: string;
  variations?: Array<{
    id: string;
    name: string;
    priceModifier: number;
  }>;
}

interface AdminOrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  customizationNote?: string | null;
  product?: { id: string; name: string; image: string };
  variation?: { id: string; name: string; priceModifier: number } | null;
}

interface AdminOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: string;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItem[];
  userId?: string | null;
  user?: { name: string; email: string; image?: string } | null;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
  orderCount?: number;
  sessionCount?: number;
}

interface AdminState {
  products: AdminProduct[];
  orders: AdminOrder[];
  users: AdminUser[];
  productsLoading: boolean;
  ordersLoading: boolean;
  usersLoading: boolean;
  error: string | null;
}

const initialState: AdminState = {
  products: [],
  orders: [],
  users: [],
  productsLoading: false,
  ordersLoading: false,
  usersLoading: false,
  error: null,
};

type AdminApiResponse = Record<string, unknown> & {
  data?: Record<string, unknown>;
};

const extractList = <T>(data: AdminApiResponse, key: string): T[] => {
  const nested = data.data?.[key];
  const top = data[key];
  return (nested ?? top ?? []) as T[];
};

export const fetchAdminProducts = createAsyncThunk(
  "admin/fetchProducts",
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiClient.get<AdminApiResponse>("/api/admin/products");
      return extractList<AdminProduct>(data, "products");
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to fetch products");
    }
  },
);

export const fetchAdminOrders = createAsyncThunk(
  "admin/fetchOrders",
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiClient.get<AdminApiResponse>("/api/admin/orders");
      return extractList<AdminOrder>(data, "orders");
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to fetch orders");
    }
  },
);

export const fetchAdminUsers = createAsyncThunk(
  "admin/fetchUsers",
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiClient.get<AdminApiResponse>("/api/admin/users");
      return extractList<AdminUser>(data, "users");
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to fetch users");
    }
  },
);

export const updateAdminOrderStatus = createAsyncThunk(
  "admin/updateOrderStatus",
  async (
    {
      id,
      status,
      trackingNumber,
      shippingProvider,
    }: {
      id: string;
      status: string;
      trackingNumber?: string | null;
      shippingProvider?: string | null;
    },
    { rejectWithValue },
  ) => {
    try {
      const optionalFields = { trackingNumber, shippingProvider };
      const body: Record<string, unknown> = {
        status,
        ...Object.fromEntries(
          Object.entries(optionalFields).filter(
            ([_, value]) => value !== undefined,
          ),
        ),
      };
      const data = await apiClient.patch<Record<string, unknown>>(
        `/api/admin/orders/${id}`,
        body,
      );
      const order = [data.data, data.order, data].find(
        (v): v is Record<string, unknown> => v !== undefined && v !== null,
      );
      return order as unknown as AdminOrder;
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to update order");
    }
  },
);

export const updateAdminUserRole = createAsyncThunk(
  "admin/updateUserRole",
  async ({ id, role }: { id: string; role: string }, { rejectWithValue }) => {
    try {
      const data = await apiClient.patch<Record<string, unknown>>(
        `/api/admin/users/${id}`,
        { role },
      );
      return ((data.data as Record<string, unknown>)?.user ??
        data.user ??
        data) as AdminUser;
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to update user role");
    }
  },
);

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    clearAdminError(state) {
      state.error = null;
    },
    removeProduct(state, action) {
      state.products = state.products.filter((p) => p.id !== action.payload);
    },
    upsertProduct(state, action) {
      const idx = state.products.findIndex((p) => p.id === action.payload.id);
      if (idx >= 0) {
        state.products[idx] = action.payload;
      } else {
        state.products.unshift(action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Products
      .addCase(fetchAdminProducts.pending, (state) => {
        state.productsLoading = true;
        state.error = null;
      })
      .addCase(fetchAdminProducts.fulfilled, (state, action) => {
        state.productsLoading = false;
        state.products = action.payload;
      })
      .addCase(fetchAdminProducts.rejected, (state, action) => {
        state.productsLoading = false;
        state.error = action.payload as string;
      })
      // Orders
      .addCase(fetchAdminOrders.pending, (state) => {
        state.ordersLoading = true;
        state.error = null;
      })
      .addCase(fetchAdminOrders.fulfilled, (state, action) => {
        state.ordersLoading = false;
        state.orders = action.payload;
      })
      .addCase(fetchAdminOrders.rejected, (state, action) => {
        state.ordersLoading = false;
        state.error = action.payload as string;
      })
      // Users
      .addCase(fetchAdminUsers.pending, (state) => {
        state.usersLoading = true;
        state.error = null;
      })
      .addCase(fetchAdminUsers.fulfilled, (state, action) => {
        state.usersLoading = false;
        state.users = action.payload;
      })
      .addCase(fetchAdminUsers.rejected, (state, action) => {
        state.usersLoading = false;
        state.error = action.payload as string;
      })
      // Update order status
      .addCase(updateAdminOrderStatus.fulfilled, (state, action) => {
        const idx = state.orders.findIndex((o) => o.id === action.payload.id);
        if (idx >= 0) {
          state.orders[idx] = { ...state.orders[idx], ...action.payload };
        }
      })
      // Update user role
      .addCase(updateAdminUserRole.fulfilled, (state, action) => {
        const idx = state.users.findIndex((u) => u.id === action.payload.id);
        if (idx >= 0) {
          state.users[idx] = { ...state.users[idx], ...action.payload };
        }
      });
  },
});

export const { clearAdminError, removeProduct, upsertProduct } =
  adminSlice.actions;

export const selectAdminProducts = (state: RootState) => state.admin.products;
export const selectAdminOrders = (state: RootState) => state.admin.orders;
export const selectAdminUsers = (state: RootState) => state.admin.users;
export const selectAdminProductsLoading = (state: RootState) =>
  state.admin.productsLoading;
export const selectAdminOrdersLoading = (state: RootState) =>
  state.admin.ordersLoading;
export const selectAdminUsersLoading = (state: RootState) =>
  state.admin.usersLoading;
export const selectAdminError = (state: RootState) => state.admin.error;

export default adminSlice.reducer;
