'use client'

import { useState } from 'react'
import { Provider } from 'react-redux'
import { makeOrdersStore, type OrdersStore } from '@/lib/store'

/**
 * Mounts a dedicated Redux store for order detail routes. Nested inside
 * the root storefront Provider so order pages get the orders-only slice
 * without shipping it to every storefront route.
 */
export default function OrdersStoreProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [store] = useState<OrdersStore>(() => makeOrdersStore())

  return <Provider store={store}>{children}</Provider>
}
