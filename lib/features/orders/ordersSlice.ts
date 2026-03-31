import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "@/lib/store";
import { apiClient, ApiError } from "@/lib/api-client";

// Types matching API responses
interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  customizationNote?: string | null;
  product?: {
    id: string;
    name: string;
    image: string;
    price: number;
  };
  variation?: {
    id: string;
    name: string;
    price: number;
  } | null;
}

interface Order {
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
  items: OrderItem[];
  userId?: string | null;
}

interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  detailLoading: boolean;
  cancelling: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  orders: [],
  currentOrder: null,
  loading: false,
  detailLoading: false,
  cancelling: false,
  error: null,
};

export const fetchOrders = createAsyncThunk(
  "orders/fetchOrders",
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiClient.get<{
        orders?: Order[];
        data?: { orders?: Order[] };
      }>("/api/orders");
      return data.orders || data.data?.orders || [];
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to fetch orders");
    }
  },
);

export const fetchOrderById = createAsyncThunk(
  "orders/fetchOrderById",
  async (id: string, { rejectWithValue }) => {
    try {
      const data = await apiClient.get<{
        order?: Order;
        data?: { order?: Order };
      }>(`/api/orders/${id}`);
      return (data.order || data.data?.order) as Order;
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to fetch order");
    }
  },
);

export const cancelOrder = createAsyncThunk(
  "orders/cancelOrder",
  async (id: string, { rejectWithValue }) => {
    try {
      const data = await apiClient.patch<{
        order?: Order;
        data?: { order?: Order };
      }>(`/api/orders/${id}`, { action: "cancel" });
      return (data.order || data.data?.order) as Order;
    } catch (error) {
      if (error instanceof ApiError) return rejectWithValue(error.message);
      return rejectWithValue("Failed to cancel order");
    }
  },
);

const ordersSlice = createSlice({
  name: "orders",
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
      })
      // cancelOrder
      .addCase(cancelOrder.pending, (state) => {
        state.cancelling = true;
        state.error = null;
      })
      .addCase(cancelOrder.fulfilled, (state, action) => {
        state.cancelling = false;
        state.currentOrder = action.payload;
        const idx = state.orders.findIndex((o) => o.id === action.payload.id);
        if (idx !== -1) {
          state.orders[idx] = action.payload;
        }
      })
      .addCase(cancelOrder.rejected, (state, action) => {
        state.cancelling = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearOrderError, clearCurrentOrder } = ordersSlice.actions;

export const selectOrders = (state: RootState) => state.orders.orders;
export const selectOrdersLoading = (state: RootState) => state.orders.loading;
export const selectOrdersError = (state: RootState) => state.orders.error;
export const selectCurrentOrder = (state: RootState) =>
  state.orders.currentOrder;
export const selectOrderDetailLoading = (state: RootState) =>
  state.orders.detailLoading;
export const selectOrderCancelling = (state: RootState) =>
  state.orders.cancelling;

export default ordersSlice.reducer;
