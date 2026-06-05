import { configureStore } from '@reduxjs/toolkit'
import cartReducer from '@/features/cart/store/cartSlice'
import ordersReducer from '@/features/orders/store/ordersSlice'
import adminReducer from '@/features/admin/store/adminSlice'
import wishlistReducer from '@/features/wishlist/store/wishlistSlice'

/**
 * Storefront Redux store.
 *
 * Mounted at the root layout and therefore loaded by every non-admin route.
 * Only register slices that are consumed on every storefront page (cart,
 * wishlist). Route-scoped state lives in dedicated stores loaded lazily by
 * their owning layouts: orders state in `makeOrdersStore` (see
 * `src/app/orders/[id]/layout.tsx`) and admin state in `makeAdminStore`
 * (see `src/app/admin/layout.tsx`).
 */
export const makeStore = () =>
  configureStore({
    reducer: {
      cart: cartReducer,
      wishlist: wishlistReducer,
    },
  })

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']

/**
 * Orders Redux store.
 *
 * Mounted at `src/app/orders/[id]/layout.tsx` so the orders reducer is
 * excluded from the storefront client bundle and only hydrates on order
 * detail pages, which are the only consumers of this slice today.
 */
export const makeOrdersStore = () =>
  configureStore({
    reducer: {
      orders: ordersReducer,
    },
  })

export type OrdersStore = ReturnType<typeof makeOrdersStore>
export type OrdersRootState = ReturnType<OrdersStore['getState']>
export type OrdersDispatch = OrdersStore['dispatch']

/**
 * Admin Redux store.
 *
 * Mounted at `src/app/admin/layout.tsx` so the admin reducer and its
 * dependencies are not included in the storefront client bundle. Nested
 * react-redux Providers are supported: components rendered under the
 * admin layout receive this store via `useSelector`/`useDispatch`.
 */
export const makeAdminStore = () =>
  configureStore({
    reducer: {
      admin: adminReducer,
    },
  })

export type AdminStore = ReturnType<typeof makeAdminStore>
export type AdminRootState = ReturnType<AdminStore['getState']>
export type AdminDispatch = AdminStore['dispatch']
