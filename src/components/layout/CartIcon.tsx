'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchCart, selectCartItemCount } from '@/features/cart/store/cartSlice'
import { getPendingCartItemCount } from '@/features/cart/services/pending-cart'
import type { AppDispatch } from '@/lib/store'
import { FloralCartIcon } from '@/components/ui/DecorativeElements'

const PENDING_CART_UPDATED_EVENT = 'pending-cart-updated'

export default function CartIcon() {
  const { status } = useSession()
  const dispatch = useDispatch<AppDispatch>()
  const authenticatedItemCount = useSelector(selectCartItemCount)
  const [guestItemCount, setGuestItemCount] = useState(0)

  useEffect(() => {
    if (status === 'authenticated') {
      dispatch(fetchCart())
      return
    }

    if (status === 'loading') return

    const refreshGuestCount = () => {
      setGuestItemCount(getPendingCartItemCount())
    }

    refreshGuestCount()
    globalThis.window.addEventListener(PENDING_CART_UPDATED_EVENT, refreshGuestCount)
    globalThis.window.addEventListener('storage', refreshGuestCount)

    return () => {
      globalThis.window.removeEventListener(
        PENDING_CART_UPDATED_EVENT,
        refreshGuestCount
      )
      globalThis.window.removeEventListener('storage', refreshGuestCount)
    }
  }, [dispatch, status])

  const itemCount =
    status === 'authenticated' ? authenticatedItemCount : guestItemCount

  return (
    <Link
      href="/cart"
      className="relative text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 focus-warm rounded-full"
      aria-label="Shopping cart"
    >
      <FloralCartIcon className="w-6 h-6" />
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-warm">
          {itemCount}
        </span>
      )}
    </Link>
  )
}
