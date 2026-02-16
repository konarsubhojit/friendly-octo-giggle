import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/lib/store';

// Types matching API responses
interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    image: string;
    price: number;
  };
  variation?: {
    id: string;
    name: string;
    priceModifier: number;
  } | null;
}

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  userId?: string | null;
}

interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  orders: [],
  currentOrder: null,
  loading: false,
  detailLoading: false,
  error: null,
};

export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async (_, { rejectWithValue }) => {
    const res = await fetch('/api/orders');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return rejectWithValue(err.error || 'Failed to fetch orders');
    }
    const data = await res.json();
    return data.orders || data.data?.orders || [];
  }
);

export const fetchOrderById = createAsyncThunk(
  'orders/fetchOrderById',
  async (id: string, { rejectWithValue }) => {
    const res = await fetch(`/api/orders/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return rejectWithValue(err.error || 'Failed to fetch order');
    }
    const data = await res.json();
    return data.order || data.data?.order || data;
  }
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearOrderError(state) {
      state.error = null;
    },
    clearCurrentOrder(state) {
      state.currentOrder = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchOrders
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchOrderById
      .addCase(fetchOrderById.pending, (state) => {
        state.detailLoading = true;
        state.error = null;
      })
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.currentOrder = action.payload;
      })
      .addCase(fetchOrderById.rejected, (state, action) => {
        state.detailLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearOrderError, clearCurrentOrder } = ordersSlice.actions;

export const selectOrders = (state: RootState) => state.orders.orders;
export const selectOrdersLoading = (state: RootState) => state.orders.loading;
export const selectOrdersError = (state: RootState) => state.orders.error;
export const selectCurrentOrder = (state: RootState) => state.orders.currentOrder;
export const selectOrderDetailLoading = (state: RootState) => state.orders.detailLoading;

export default ordersSlice.reducer;
