interface ProductSummaryItem {
  readonly quantity?: number;
  readonly product?: {
    readonly name: string;
  } | null;
}

function getUniqueProductNames(items: readonly ProductSummaryItem[]) {
  const names = items
    .map((item) => item.product?.name?.trim())
    .filter((name): name is string => Boolean(name));

  return [...new Set(names)];
}

export function summarizeOrderProducts(
  items: readonly ProductSummaryItem[],
  maxVisibleNames = 2,
) {
  const productNames = getUniqueProductNames(items);

  if (productNames.length === 0) {
    return "Order items unavailable";
  }

  const visibleNames = productNames.slice(0, Math.max(1, maxVisibleNames));
  const remainingCount = productNames.length - visibleNames.length;

  if (remainingCount <= 0) {
    return visibleNames.join(", ");
  }

  return `${visibleNames.join(", ")} and ${remainingCount} more`;
}

export function countOrderUnits(items: readonly ProductSummaryItem[]) {
  return items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}