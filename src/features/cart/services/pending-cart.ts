/**
 * Utility for persisting pending cart items in localStorage so they survive
 * the login redirect and can be merged into the user's server-side cart after
 * authentication.
 */

const SHORT_ID_RE = /^[0-9A-Za-z]{7}$/

export interface PendingCartItem {
  readonly productId: string
  readonly variantId: string
  readonly quantity: number
}

const PENDING_CART_KEY = 'pending_cart_items'

function isValidPendingCartItem(item: unknown): item is PendingCartItem {
  if (typeof item !== 'object' || item === null) return false
  const { productId, variantId, quantity } = item as Record<string, unknown>
  return (
    typeof productId === 'string' &&
    SHORT_ID_RE.test(productId) &&
    typeof variantId === 'string' &&
    SHORT_ID_RE.test(variantId) &&
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity > 0
  )
}

export function getPendingCartItems(): PendingCartItem[] {
  if (globalThis.window === undefined) return []
  try {
    const raw = localStorage.getItem(PENDING_CART_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Filter out legacy entries that don't have a valid variantId
    return parsed.filter(isValidPendingCartItem)
  } catch {
    return []
  }
}

export function addPendingCartItem(item: PendingCartItem): void {
  if (globalThis.window === undefined) return
  const items = getPendingCartItems()

  const existing = items.find(
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
}

export function clearPendingCartItems(): void {
  if (globalThis.window === undefined) return
  localStorage.removeItem(PENDING_CART_KEY)
}

export function hasPendingCartItems(): boolean {
  return getPendingCartItems().length > 0
}
