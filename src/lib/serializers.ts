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

/** A timestamp that may arrive as a Date, an ISO string, or not at all. */
type NullableTimestamp = Date | string | null

/** The shape `serializeCustomerReturn` accepts; a superset is fine. */
export interface SerializableReturn {
  readonly id: string
  readonly orderId: string
  readonly status: string
  readonly reason: string
  readonly customerNote: string | null
  readonly decisionReason: string | null
  readonly refundAmount: number
  readonly createdAt: Date | string
  readonly decidedAt: NullableTimestamp
  readonly receivedAt: NullableTimestamp
  readonly items?: ReadonlyArray<{
    readonly orderItemId: string
    readonly quantity: number
    readonly refundableAmount: number
  }>
  readonly evidence?: ReadonlyArray<{
    readonly id: string
    readonly url: string
  }>
  readonly refund?: {
    readonly amount: number
    readonly status: string
    readonly processedAt: NullableTimestamp
  } | null
}

/**
 * Project a return onto the fields a customer may see.
 *
 * Built by naming every field explicitly rather than spreading the row: a
 * spread would leak any column added later — `decidedById`, `receivedById`,
 * `stockRestoredAt`, `refundId`, `gatewayRefundId`, `errorMessage`,
 * `paymentTransactionId` and variant stock are all staff-only, and the default
 * for a new column must be "hidden" rather than "exposed".
 *
 * A `FAILED` refund is deliberately reported as `PROCESSING`. A gateway retry
 * is an internal operational concern and the customer's entitlement is
 * unchanged, so surfacing the failure would alarm them about a problem they
 * cannot act on.
 */
export const serializeCustomerReturn = (returnRequest: SerializableReturn) => ({
  id: returnRequest.id,
  orderId: returnRequest.orderId,
  status: returnRequest.status,
  reason: returnRequest.reason,
  customerNote: returnRequest.customerNote,
  decisionReason: returnRequest.decisionReason,
  refundAmount: returnRequest.refundAmount,
  createdAt: toISOString(returnRequest.createdAt),
  decidedAt: returnRequest.decidedAt
    ? toISOString(returnRequest.decidedAt)
    : null,
  receivedAt: returnRequest.receivedAt
    ? toISOString(returnRequest.receivedAt)
    : null,
  items: (returnRequest.items ?? []).map((item) => ({
    orderItemId: item.orderItemId,
    quantity: item.quantity,
    refundableAmount: item.refundableAmount,
  })),
  evidence: (returnRequest.evidence ?? []).map((item) => ({
    id: item.id,
    url: item.url,
  })),
  refund: returnRequest.refund
    ? {
        amount: returnRequest.refund.amount,
        status:
          returnRequest.refund.status === 'FAILED'
            ? 'PROCESSING'
            : returnRequest.refund.status,
        processedAt: returnRequest.refund.processedAt
          ? toISOString(returnRequest.refund.processedAt)
          : null,
      }
    : null,
})
