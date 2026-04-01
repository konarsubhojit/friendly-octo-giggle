interface ProductSummaryItem {
  readonly quantity?: number;
  readonly product?: {
    readonly name: string;
  } | null;
}

interface CheckoutPriceItem {
  readonly quantity?: number;
  readonly product?: {
    readonly price: number;
    readonly name: string;
  } | null;
  readonly variation?: {
    readonly name: string;
    readonly designName?: string | null;
    readonly price: number;
  } | null;
  readonly customizationNote?: string | null;
}

export interface CheckoutSummaryLineItem {
  readonly name: string;
  readonly variationLabel: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
  readonly customizationNote: string | null;
}

export interface CheckoutPricingSummary {
  readonly itemCount: number;
  readonly subtotal: number;
  readonly shippingAmount: number;
  readonly total: number;
}

function buildCheckoutPricingSummaryFromDerivedItems(
  lineItems: readonly CheckoutSummaryLineItem[],
): CheckoutPricingSummary {
  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    itemCount,
    subtotal,
    shippingAmount: 0,
    total: subtotal,
  };
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

function getVariationLabel(item: CheckoutPriceItem) {
  const parts = [item.variation?.name, item.variation?.designName].filter(
    (value): value is string => Boolean(value),
  );

  if (parts.length === 0) {
    return null;
  }

  return [...new Set(parts)].join(" - ");
}

export function buildCheckoutSummaryLineItems(
  items: readonly CheckoutPriceItem[],
): CheckoutSummaryLineItem[] {
  return items.map((item) => {
    const quantity = item.quantity ?? 0;
    const basePrice = item.product?.price ?? 0;
    const unitPrice = item.variation?.price ?? basePrice;

    return {
      name: item.product?.name ?? "Product unavailable",
      variationLabel: getVariationLabel(item),
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      customizationNote: item.customizationNote ?? null,
    };
  });
}

export function buildCheckoutPricingSummary(
  items: readonly CheckoutPriceItem[],
): CheckoutPricingSummary {
  const lineItems = buildCheckoutSummaryLineItems(items);

  return buildCheckoutPricingSummaryFromDerivedItems(lineItems);
}

export function buildCheckoutPricingSummaryFromLineItems(
  lineItems: readonly CheckoutSummaryLineItem[],
): CheckoutPricingSummary {
  return buildCheckoutPricingSummaryFromDerivedItems(lineItems);
}
