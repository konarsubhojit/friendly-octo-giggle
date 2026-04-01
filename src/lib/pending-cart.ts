/**
 * Utility for persisting pending cart items in localStorage so they survive
 * the login redirect and can be merged into the user's server-side cart after
 * authentication.
 */

export interface PendingCartItem {
  readonly productId: string;
  readonly variationId: string | null;
  readonly quantity: number;
}

const PENDING_CART_KEY = "pending_cart_items";

export function getPendingCartItems(): PendingCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingCartItem[];
  } catch {
    return [];
  }
}

export function addPendingCartItem(item: PendingCartItem): void {
  if (typeof window === "undefined") return;
  const items = getPendingCartItems();

  const existing = items.find(
    (i) => i.productId === item.productId && i.variationId === item.variationId,
  );

  let updated: PendingCartItem[];
  if (existing) {
    updated = items.map((i) =>
      i.productId === item.productId && i.variationId === item.variationId
        ? { ...i, quantity: i.quantity + item.quantity }
        : i,
    );
  } else {
    updated = [...items, item];
  }

  localStorage.setItem(PENDING_CART_KEY, JSON.stringify(updated));
}

export function clearPendingCartItems(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_CART_KEY);
}

export function hasPendingCartItems(): boolean {
  return getPendingCartItems().length > 0;
}
