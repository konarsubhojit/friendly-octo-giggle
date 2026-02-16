import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/lib/store';

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

export const fetchAdminProducts = createAsyncThunk(
  'admin/fetchProducts',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/admin/products');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return rejectWithValue(err.error || 'Failed to fetch products');
    }
    const data = await res.json();
    return data.data?.products || data.products || [];
  }
);

export const fetchAdminOrders = createAsyncThunk(
  'admin/fetchOrders',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/admin/orders');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return rejectWithValue(err.error || 'Failed to fetch orders');
    }
    const data = await res.json();
    return data.data?.orders || data.orders || [];
  }
);

export const fetchAdminUsers = createAsyncThunk(
  'admin/fetchUsers',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/admin/users');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return rejectWithValue(err.error || 'Failed to fetch users');
    }
    const data = await res.json();
    return data.data?.users || data.users || [];
  }
);

export const updateAdminOrderStatus = createAsyncThunk(
  'admin/updateOrderStatus',
  async ({ id, status }: { id: string; status: string }, { rejectWithValue }) => {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return rejectWithValue(err.error || 'Failed to update order');
    }
    const data = await res.json();
    return data.data?.order || data.order || data;
  }
);

export const updateAdminUserRole = createAsyncThunk(
  'admin/updateUserRole',
  async ({ id, role }: { id: string; role: string }, { rejectWithValue }) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return rejectWithValue(err.error || 'Failed to update user role');
    }
    const data = await res.json();
    return data.data?.user || data.user || data;
  }
);

const adminSlice = createSlice({
  name: 'admin',
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

export const { clearAdminError, removeProduct, upsertProduct } = adminSlice.actions;

export const selectAdminProducts = (state: RootState) => state.admin.products;
export const selectAdminOrders = (state: RootState) => state.admin.orders;
export const selectAdminUsers = (state: RootState) => state.admin.users;
export const selectAdminProductsLoading = (state: RootState) => state.admin.productsLoading;
export const selectAdminOrdersLoading = (state: RootState) => state.admin.ordersLoading;
export const selectAdminUsersLoading = (state: RootState) => state.admin.usersLoading;
export const selectAdminError = (state: RootState) => state.admin.error;

export default adminSlice.reducer;
