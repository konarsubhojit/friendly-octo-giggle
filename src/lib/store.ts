import { configureStore } from '@reduxjs/toolkit'
import cartReducer from '@/features/cart/store/cartSlice'
import ordersReducer from '@/features/orders/store/ordersSlice'
import adminReducer from '@/features/admin/store/adminSlice'
import wishlistReducer from '@/features/wishlist/store/wishlistSlice'

export const makeStore = () =>
  configureStore({
    reducer: {
      cart: cartReducer,
      orders: ordersReducer,
      admin: adminReducer,
      wishlist: wishlistReducer,
    },
  })

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
