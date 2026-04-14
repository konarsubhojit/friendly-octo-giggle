import type { InferSelectModel } from 'drizzle-orm'
import { orders, orderItems, products, productVariants } from './schema'

type DbOrder = InferSelectModel<typeof orders>
type DbOrderItem = InferSelectModel<typeof orderItems>
type DbProduct = InferSelectModel<typeof products>
type DbProductVariant = InferSelectModel<typeof productVariants>

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

export const serializeVariant = <T extends DbProductVariant>(variant: T) => ({
  ...variant,
  sku: variant.sku ?? null,
  image: variant.image ?? null,
  images: variant.images ?? [],
  createdAt: toISOString(variant.createdAt),
  updatedAt: toISOString(variant.updatedAt),
  deletedAt: variant.deletedAt ? toISOString(variant.deletedAt) : null,
})

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
