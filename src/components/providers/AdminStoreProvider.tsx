'use client'

import { useState } from 'react'
import { Provider } from 'react-redux'
import { makeAdminStore, type AdminStore } from '@/lib/store'

/**
 * Mounts a dedicated Redux store for admin routes. Nested inside the root
 * storefront Provider so admin pages get the admin-only slice without
 * shipping it to storefront routes.
 */
export default function AdminStoreProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [store] = useState<AdminStore>(() => makeAdminStore())

  return <Provider store={store}>{children}</Provider>
}
