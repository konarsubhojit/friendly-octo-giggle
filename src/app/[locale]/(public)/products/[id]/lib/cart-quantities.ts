/** Aggregate per-variant cart quantities for a given product. */
export const computeCartQuantities = (
  items:
    | { productId: string; variantId?: string | null; quantity: number }[]
    | undefined,
  productId: string
): Record<string, number> => {
  const map: Record<string, number> = {}
  if (!items) return map
  for (const item of items) {
    if (item.productId !== productId) continue
    const key = item.variantId ?? '__base__'
    map[key] = (map[key] ?? 0) + item.quantity
  }
  return map
}

/** Apply cart dispatch result — set success/warning state. */
export const applyCartResult = (
  result: { warning?: string | null; adjustedQuantity?: number | null },
  remainingStock: number,
  setQuantity: (q: number) => void,
  setStockWarning: (s: string) => void,
  setCartSuccess: (b: boolean) => void
): void => {
  if (result.warning) {
    if (result.adjustedQuantity) {
      setQuantity(Math.min(result.adjustedQuantity, remainingStock))
    }
    setStockWarning(result.warning)
    setCartSuccess(true)
    setTimeout(() => {
      setCartSuccess(false)
      setStockWarning('')
    }, 5000)
  } else {
    setCartSuccess(true)
    setTimeout(() => setCartSuccess(false), 3000)
  }
}
