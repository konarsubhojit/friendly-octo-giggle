/**
 * Utility for persisting pending cart items in localStorage so they survive
 * the login redirect and can be merged into the user's server-side cart after
 * authentication.
 */

import { SHORT_ID_REGEX } from '@/lib/validations/primitives'

export interface PendingCartItem {
  readonly productId: string
  readonly variantId: string
  readonly quantity: number
}

const PENDING_CART_KEY = 'pending_cart_items'
const PENDING_CART_UPDATED_EVENT = 'pending-cart-updated'

function isValidPendingCartItem(item: unknown): item is PendingCartItem {
  if (typeof item !== 'object' || item === null) return false
  const { productId, variantId, quantity } = item as Record<string, unknown>
  return (
    typeof productId === 'string' &&
    SHORT_ID_REGEX.test(productId) &&
    typeof variantId === 'string' &&
    SHORT_ID_REGEX.test(variantId) &&
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity > 0
  )
}

function notifyPendingCartUpdated(): void {
  if (globalThis.window === undefined) return
  globalThis.window.dispatchEvent(new Event(PENDING_CART_UPDATED_EVENT))
}

export function getPendingCartItems(): PendingCartItem[] {
  if (globalThis.window === undefined) return []
  try {
    const raw = localStorage.getItem(PENDING_CART_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidPendingCartItem)
  } catch {
    return []
  }
}

export function getPendingCartItemCount(): number {
  return getPendingCartItems().reduce((total, item) => total + item.quantity, 0)
}

export function addPendingCartItem(item: PendingCartItem): void {
  if (globalThis.window === undefined) return
  const items = getPendingCartItems()

  const existing = items.some(
    (i) => i.productId === item.productId && i.variantId === item.variantId
  )

  let updated: PendingCartItem[]
  if (existing) {
    updated = items.map((i) =>
      i.productId === item.productId && i.variantId === item.variantId
        ? { ...i, quantity: i.quantity + item.quantity }
        : i
    )
  } else {
    updated = [...items, item]
  }

  localStorage.setItem(PENDING_CART_KEY, JSON.stringify(updated))
  notifyPendingCartUpdated()
}

export function clearPendingCartItems(): void {
  if (globalThis.window === undefined) return
  localStorage.removeItem(PENDING_CART_KEY)
  notifyPendingCartUpdated()
}

export function hasPendingCartItems(): boolean {
  return getPendingCartItems().length > 0
}
