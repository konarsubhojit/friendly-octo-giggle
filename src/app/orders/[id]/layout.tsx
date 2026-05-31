import type { ReactNode } from 'react'
import OrdersStoreProvider from '@/components/providers/OrdersStoreProvider'

/**
 * Layout for order detail routes. Mounts an orders-scoped Redux store so
 * the orders slice is only loaded when the user visits an order page.
 */
export default function OrderDetailLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <OrdersStoreProvider>{children}</OrdersStoreProvider>
}
