import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './features/cart/cartSlice';
import ordersReducer from './features/orders/ordersSlice';
import adminReducer from './features/admin/adminSlice';

export const makeStore = () =>
  configureStore({
    reducer: {
      cart: cartReducer,
      orders: ordersReducer,
      admin: adminReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
