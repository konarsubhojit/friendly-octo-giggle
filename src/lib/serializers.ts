import type { InferSelectModel } from 'drizzle-orm'
import {
  orders,
  orderItems,
  products,
  productVariants,
  productOptionValues,
} from './schema'

type DbOrder = InferSelectModel<typeof orders>
type DbOrderItem = InferSelectModel<typeof orderItems>
type DbProduct = InferSelectModel<typeof products>
type DbProductVariant = InferSelectModel<typeof productVariants>
type DbProductOptionValue = InferSelectModel<typeof productOptionValues>

/** Shape returned by Drizzle when loading variant → optionValues → optionValue */
interface VariantOptionValueLink {
  optionValue: DbProductOptionValue
}

type OrderWithItems = DbOrder & {
  items: (DbOrderItem & {
    product: DbProduct
    variant: DbProductVariant | null
  })[]
}

const toISOString = (value: Date | string): string => {
  if (typeof value === 'string') return value
  return value.toISOString()
}

export const serializeProduct = <T extends DbProduct>(product: T) => ({
  ...product,
  createdAt: toISOString(product.createdAt),
  updatedAt: toISOString(product.updatedAt),
  deletedAt: product.deletedAt ? toISOString(product.deletedAt) : null,
})

/**
 * Flatten variant option-value join records into a flat `ProductOptionValue[]`.
 * Handles both raw DB rows (with nested `optionValue`) and already-flattened data.
 */
function flattenOptionValues(
  links: VariantOptionValueLink[] | undefined
): Array<{
  id: string
  optionId: string
  value: string
  sortOrder: number
  createdAt: string
}> {
  if (!links || links.length === 0) return []
  return links.map((link) => ({
    id: link.optionValue.id,
    optionId: link.optionValue.optionId,
    value: link.optionValue.value,
    sortOrder: link.optionValue.sortOrder,
    createdAt: toISOString(link.optionValue.createdAt),
  }))
}

export const serializeVariant = <
  T extends DbProductVariant & {
    optionValues?: VariantOptionValueLink[]
  },
>(
  variant: T
) => {
  const { optionValues: rawOptionValues, ...rest } = variant
  return {
    ...rest,
    sku: rest.sku ?? null,
    image: rest.image ?? null,
    images: rest.images ?? [],
    createdAt: toISOString(rest.createdAt),
    updatedAt: toISOString(rest.updatedAt),
    deletedAt: rest.deletedAt ? toISOString(rest.deletedAt) : null,
    optionValues: flattenOptionValues(rawOptionValues),
  }
}

export const serializeProductWithVariants = <
  T extends DbProduct & { variants: DbProductVariant[] },
>(
  product: T
) => ({
  ...serializeProduct(product),
  variants: product.variants.map(serializeVariant),
})

export const serializeOrder = (order: OrderWithItems) => ({
  ...order,
  createdAt: toISOString(order.createdAt),
  updatedAt: toISOString(order.updatedAt),
  items: order.items.map((item) => ({
    ...item,
    product: serializeProduct(item.product),
    variant: item.variant ? serializeVariant(item.variant) : null,
  })),
})

export const serializeOrders = (orders: OrderWithItems[]) =>
  orders.map(serializeOrder)
