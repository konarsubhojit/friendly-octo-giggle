import { CouponConflictError, db, StockConflictError } from '@/lib/db'
import { formatStructuredAddress } from '@/lib/address-utils'
import { invalidateOrderCaches } from '@/features/orders/services/order-cache'
import { CreateOrderInput, OrderItemInput } from '@/lib/types'
import {
  logBusinessEvent,
  logPerformance,
  ORDER_CREATE_OPERATION,
} from '@/lib/logger'
import { roundMoney } from '@/lib/money'
import {
  calculateOrderTotals,
  type OrderTotals,
  type PricedOrderItem,
} from './order-pricing'
import {
  getShippingMethodLabel,
  toShippingMethod,
  type ShippingMethodName,
} from '@/lib/shipping'
import { notifyOrderConfirmation } from '@/lib/notifications/order-notifications'
import { orderCreated } from '@/features/orders/inngest/events'
import { dispatchWorkflowEvent } from '@/lib/inngest/dispatch'
import {
  checkoutSession,
  orderSession,
  mergeSessions,
} from '@/lib/inngest/sessions'
import { waitUntil } from '@vercel/functions'
import { writeOrderToRedis } from '@/features/orders/actions/orders'
import {
  formatPriceForCurrency,
  isValidCurrencyCode,
  type CurrencyCode,
} from '@/lib/currency'
import {
  PaymentConfigurationError,
  PaymentVerificationError,
  verifyCheckoutPayment,
  type VerifiedPayment,
} from '@/lib/payments'
import {
  isCouponError,
  resolveCartDiscount,
  type AppliedCoupon,
  type DiscountCartItem,
} from '@/features/cart/services/coupon-service'
import {
  OrderRequestError,
  type OrderSessionUser,
} from './order-service.shared'

type ProductWithVariants = {
  id: string
  name: string
  category: string
  variants: Array<{
    id: string
    price: number
    stock: number
    weightGrams?: number | null
  }>
}

type ValidationResult =
  | {
      valid: true
      customerName: string
      customerEmail: string
      customerAddress: string
      addressLine1: string
      addressLine2: string
      addressLine3: string
      pinCode: string
      city: string
      state: string
    }
  | { valid: false; error: string; status: number; reason: string }

type StockCheckResult =
  | { valid: true; pricedItems: PricedOrderItem[] }
  | {
      valid: false
      error: string
      status: number
      reason: string
      details?: Record<string, unknown>
    }

interface HydratedOrderItem {
  productId: string
  variantId: string
  quantity: number
  price: number
  customizationNote: string | null
  product: {
    name: string
    image: string
    createdAt: Date
    updatedAt: Date
  }
}

interface HydratedOrder {
  id: string
  customerName: string
  customerEmail: string
  customerAddress: string
  subtotalAmount: number
  shippingAmount: number
  taxAmount: number
  shippingMethod: ShippingMethodName | null
  totalAmount: number
  discountAmount: number
  couponCode: string | null
  status: string
  paymentStatus: string
  createdAt: Date
  updatedAt: Date
  items: HydratedOrderItem[]
}

export interface OrderCacheInvalidator {
  invalidateOrderCaches: (input: {
    userId: string
    productIds: string[]
  }) => Promise<void>
}

const serializeCreatedOrder = <
  T extends {
    createdAt: Date
    updatedAt: Date
    items: Array<{
      product: { createdAt: Date; updatedAt: Date }
    }>
  },
>(
  fullOrder: T
) => ({
  order: {
    ...fullOrder,
    createdAt: fullOrder.createdAt.toISOString(),
    updatedAt: fullOrder.updatedAt.toISOString(),
    items: fullOrder.items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        createdAt: item.product.createdAt.toISOString(),
        updatedAt: item.product.updatedAt.toISOString(),
      },
    })),
  },
})

const logFailedOrderCreation = (
  reason: string,
  status: number,
  message: string,
  details?: Record<string, unknown>
): never => {
  logBusinessEvent({
    event: 'order_create_failed',
    details: { reason, ...details },
    success: false,
  })

  throw new OrderRequestError(message, status)
}

const validateCustomerInfo = (
  body: CreateOrderInput,
  user: OrderSessionUser
): ValidationResult => {
  const customerName =
    body.customerName?.trim() || user.name?.trim() || 'Unknown'
  const customerEmail = body.customerEmail?.trim() || user.email
  const customerAddress = body.customerAddress?.trim() || ''

  const errorMap: Record<
    'missing_email' | 'missing_address',
    { error: string; status: number; reason: string }
  > = {
    missing_email: {
      error: 'Email address is required. Please update your profile.',
      status: 400,
      reason: 'missing_email',
    },
    missing_address: {
      error: 'Shipping address is required',
      status: 400,
      reason: 'missing_address',
    },
  }

  const hasStructuredAddress =
    body.addressLine1?.trim() &&
    body.pinCode?.trim() &&
    body.city?.trim() &&
    body.state?.trim()

  const checks: [boolean, keyof typeof errorMap][] = [
    [!customerEmail, 'missing_email'],
    [!customerAddress && !hasStructuredAddress, 'missing_address'],
  ]
  const found = checks.find(([condition]) => condition)
  if (found) {
    const [, reason] = found
    return { valid: false, ...errorMap[reason] }
  }

  return {
    valid: true,
    customerName,
    customerEmail: customerEmail ?? '',
    customerAddress,
    addressLine1: body.addressLine1?.trim() ?? '',
    addressLine2: body.addressLine2?.trim() ?? '',
    addressLine3: body.addressLine3?.trim() ?? '',
    pinCode: body.pinCode?.trim() ?? '',
    city: body.city?.trim() ?? '',
    state: body.state?.trim() ?? '',
  }
}

type ItemStockCheckResult =
  | { valid: true; pricedItem: PricedOrderItem }
  | {
      valid: false
      error: string
      status: number
      reason: string
      details?: Record<string, unknown>
    }

const checkStockForItem = (
  item: OrderItemInput,
  product: ProductWithVariants
): ItemStockCheckResult => {
  const variant = product.variants.find((v) => v.id === item.variantId)
  if (!variant) {
    return {
      valid: false,
      error: `Variant not found for ${product.name}`,
      status: 404,
      reason: 'variant_not_found',
    }
  }
  const price = variant.price
  const stockToCheck = variant.stock

  if (stockToCheck < item.quantity) {
    return {
      valid: false,
      error: `Insufficient stock for ${product.name}`,
      status: 400,
      reason: 'insufficient_stock',
      details: {
        productId: product.id,
        productName: product.name,
        requested: item.quantity,
        available: stockToCheck,
      },
    }
  }

  return {
    valid: true,
    pricedItem: {
      price,
      quantity: item.quantity,
      weightGrams: variant.weightGrams ?? null,
    },
  }
}

const validateStockAndCalculateTotal = (
  items: OrderItemInput[],
  productList: ProductWithVariants[]
): StockCheckResult => {
  const pricedItems: PricedOrderItem[] = []
  const productMap = new Map(
    productList.map((product) => [product.id, product])
  )

  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) {
      return {
        valid: false,
        error: `Product ${item.productId} not found`,
        status: 404,
        reason: 'product_not_found',
      }
    }

    const result = checkStockForItem(item, product)
    if (!result.valid) {
      return result
    }
    pricedItems.push(result.pricedItem)
  }

  return { valid: true, pricedItems }
}

const sanitizeCustomizationNote = (
  raw: string | null | undefined
): string | null => {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, 500)
}

const buildOrderItemValues = (
  items: OrderItemInput[],
  productList: ProductWithVariants[]
): Array<{
  productId: string
  variantId: string
  quantity: number
  price: number
  customizationNote: string | null
}> => {
  const productMap = new Map(
    productList.map((product) => [
      product.id,
      {
        variantPriceMap: new Map(
          product.variants.map((variant) => [variant.id, variant.price])
        ),
      },
    ])
  )

  return items.map((item) => {
    const product = productMap.get(item.productId)
    if (!product) {
      throw new OrderRequestError(
        `Product with id ${item.productId} not found`,
        404
      )
    }

    const price = product.variantPriceMap.get(item.variantId ?? '')
    if (price === undefined) {
      throw new OrderRequestError(
        `Variant ${item.variantId} not found for product ${item.productId}`,
        404
      )
    }

    return {
      productId: item.productId,
      variantId: item.variantId ?? '',
      quantity: item.quantity,
      price,
      customizationNote: sanitizeCustomizationNote(item.customizationNote),
    }
  })
}

const getDefaultOrderCacheInvalidator = (): OrderCacheInvalidator => ({
  invalidateOrderCaches,
})

export const validateOrderInput = ({
  body,
  user,
}: {
  body: CreateOrderInput
  user: OrderSessionUser
}) => {
  if (!body.items || body.items.length === 0) {
    logFailedOrderCreation(
      'missing_items',
      400,
      'Order must contain at least one item'
    )
  }

  const customerValidation = validateCustomerInfo(body, user)
  if (!customerValidation.valid) {
    logFailedOrderCreation(
      customerValidation.reason,
      customerValidation.status,
      customerValidation.error
    )
  }

  return {
    customerDetails: customerValidation as Extract<
      ValidationResult,
      { valid: true }
    >,
    requestedProductIds: [...new Set(body.items.map((item) => item.productId))],
  }
}

export const priceAndValidateStock = (
  items: OrderItemInput[],
  productList: ProductWithVariants[]
): StockCheckResult => validateStockAndCalculateTotal(items, productList)

export const persistOrder = async ({
  body,
  userId,
  customerDetails,
  productList,
  totals,
  totalAmount,
  discountAmount = 0,
  appliedCoupons = [],
  verifiedPayment,
  checkoutRequestId,
}: {
  body: CreateOrderInput
  userId: string
  customerDetails: Extract<ValidationResult, { valid: true }>
  productList: ProductWithVariants[]
  totals: OrderTotals
  /** Amount actually charged: the order totals minus any coupon discount. */
  totalAmount: number
  discountAmount?: number
  appliedCoupons?: readonly AppliedCoupon[]
  verifiedPayment?: VerifiedPayment | null
  checkoutRequestId?: string
}) => {
  try {
    return await db.orders.createWithItems({
      userId,
      customerDetails: {
        customerName: customerDetails.customerName,
        customerEmail: customerDetails.customerEmail,
        customerAddress:
          customerDetails.customerAddress ||
          formatStructuredAddress({
            customerAddress: '',
            addressLine1: customerDetails.addressLine1,
            addressLine2: customerDetails.addressLine2,
            addressLine3: customerDetails.addressLine3,
            pinCode: customerDetails.pinCode,
            city: customerDetails.city,
            state: customerDetails.state,
          }),
        addressLine1: customerDetails.addressLine1 || null,
        addressLine2: customerDetails.addressLine2 || null,
        addressLine3: customerDetails.addressLine3 || null,
        pinCode: customerDetails.pinCode || null,
        city: customerDetails.city || null,
        state: customerDetails.state || null,
      },
      checkoutRequestId: checkoutRequestId ?? null,
      subtotalAmount: totals.subtotal,
      shippingAmount: totals.shipping.amount,
      taxAmount: totals.tax.amount,
      shippingMethod: totals.shipping.method,
      totalAmount,
      discountAmount,
      appliedCoupons: appliedCoupons.map((applied) => ({
        couponId: applied.couponId,
        code: applied.code,
        discountAmount: applied.discountAmount,
      })),
      verifiedPayment,
      items: buildOrderItemValues(body.items, productList),
    })
  } catch (err) {
    if (err instanceof StockConflictError) {
      throw new OrderRequestError(err.message, 409)
    }
    if (err instanceof CouponConflictError) {
      throw new OrderRequestError(err.message, 409)
    }
    throw err
  }
}

export const invalidateOrderRelatedCaches = async ({
  userId,
  items,
  cacheInvalidator = getDefaultOrderCacheInvalidator(),
}: {
  userId: string
  items: OrderItemInput[]
  cacheInvalidator?: OrderCacheInvalidator
}) => {
  await cacheInvalidator.invalidateOrderCaches({
    userId,
    productIds: items.map((item) => item.productId),
  })
}

/**
 * Announce that the order exists.
 *
 * The producer states a fact and stops there: the confirmation email, the
 * Redis search mirror and the cache invalidation are all subscribers to
 * `order/created`, each retried independently and visible in one trace. That
 * replaces a QStash publish whose failure path sent mail from inside this
 * request — the largest tail-latency source on the order path.
 *
 * The fallback keeps the legacy in-process notification for environments where
 * Inngest is not configured, so a missing event key degrades latency rather
 * than losing a customer's confirmation.
 */
export const dispatchOrderNotifications = async ({
  hydratedOrder,
  userId,
  checkoutRequestId,
}: {
  hydratedOrder: HydratedOrder
  userId: string
  checkoutRequestId?: string | null
}) => {
  const userRecord = await db.users.findPreferences(userId)
  const currencyCode: CurrencyCode =
    userRecord?.currencyPreference &&
    isValidCurrencyCode(userRecord.currencyPreference)
      ? userRecord.currencyPreference
      : 'INR'

  const items = hydratedOrder.items.map((item) => ({
    name: item.product.name,
    quantity: item.quantity,
    price: item.price,
  }))

  const dispatchResult = await dispatchWorkflowEvent({
    event: orderCreated.create(
      {
        orderId: hydratedOrder.id,
        userId,
        checkoutRequestId: checkoutRequestId ?? null,
        customerEmail: hydratedOrder.customerEmail,
        customerName: hydratedOrder.customerName,
        customerAddress: hydratedOrder.customerAddress,
        subtotalAmount: hydratedOrder.subtotalAmount,
        shippingAmount: hydratedOrder.shippingAmount,
        taxAmount: hydratedOrder.taxAmount,
        shippingMethod: hydratedOrder.shippingMethod ?? undefined,
        totalAmount: hydratedOrder.totalAmount,
        discountAmount: hydratedOrder.discountAmount || undefined,
        couponCode: hydratedOrder.couponCode,
        currencyCode,
        items,
        productIds: [
          ...new Set(hydratedOrder.items.map((item) => item.productId)),
        ],
      },
      {
        meta: {
          sessions: mergeSessions(
            orderSession(hydratedOrder.id),
            // Widens the checkout session to cover everything the order goes
            // on to trigger, so a "charged but no email" report is one lookup.
            checkoutRequestId ? checkoutSession(checkoutRequestId) : undefined
          ),
        },
      }
    ),
    context: 'order_created_publish_failed',
    details: { orderId: hydratedOrder.id },
    fallback: () =>
      dispatchOrderCreatedInline({ hydratedOrder, userId, currencyCode }),
  })

  logBusinessEvent({
    event: 'order_created_dispatched',
    details: {
      orderId: hydratedOrder.id,
      dispatch: dispatchResult,
    },
    success: true,
  })
}

/**
 * Last-resort handling when `order/created` could not be published.
 *
 * Mirrors what the subscribers would have done — notify, mirror to Redis —
 * without their durability. Deliberately fire-and-forget for the email so the
 * customer's response is never held open by a mail provider.
 */
const dispatchOrderCreatedInline = async ({
  hydratedOrder,
  userId,
  currencyCode,
}: {
  hydratedOrder: HydratedOrder
  userId: string
  currencyCode: CurrencyCode
}) => {
  waitUntil(mirrorOrderToRedis({ hydratedOrder, userId }))

  await notifyOrderConfirmation({
    to: hydratedOrder.customerEmail,
    customerName: hydratedOrder.customerName,
    orderId: hydratedOrder.id,
    subtotalAmount: formatPriceForCurrency(
      hydratedOrder.subtotalAmount,
      currencyCode
    ),
    shippingAmount: formatPriceForCurrency(
      hydratedOrder.shippingAmount,
      currencyCode
    ),
    taxAmount: formatPriceForCurrency(hydratedOrder.taxAmount, currencyCode),
    shippingMethodLabel: hydratedOrder.shippingMethod
      ? getShippingMethodLabel(hydratedOrder.shippingMethod)
      : null,
    totalAmount: formatPriceForCurrency(
      hydratedOrder.totalAmount,
      currencyCode
    ),
    discountAmount: hydratedOrder.discountAmount
      ? formatPriceForCurrency(hydratedOrder.discountAmount, currencyCode)
      : null,
    couponCode: hydratedOrder.couponCode,
    shippingAddress: hydratedOrder.customerAddress,
    items: hydratedOrder.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      price: formatPriceForCurrency(item.price, currencyCode),
      variant: null,
    })),
  })
}

const fetchProductsForOrder = async (
  requestedProductIds: string[]
): Promise<ProductWithVariants[]> => {
  const productList =
    await db.products.findManyWithVariantsForOrderValidation(
      requestedProductIds
    )

  if (productList.length !== requestedProductIds.length) {
    logFailedOrderCreation(
      'products_not_found',
      404,
      'Some products not found',
      {
        requestedCount: requestedProductIds.length,
        foundCount: productList.length,
      }
    )
  }

  return productList
}

const PAYMENT_VERIFY_OPERATION = 'checkout.payment.verify'

const verifyPaymentForOrder = async ({
  payment,
  expectedAmount,
  reference,
}: {
  payment: CreateOrderInput['payment']
  expectedAmount: number
  reference?: string
}): Promise<VerifiedPayment | null> => {
  if (!payment) return null
  // The gateway call is the only external hop in this pipeline, so it is timed
  // separately from the order as a whole.
  const startedAt = Date.now()
  try {
    return await verifyCheckoutPayment({ payment, expectedAmount, reference })
  } catch (error) {
    if (
      error instanceof PaymentVerificationError ||
      error instanceof PaymentConfigurationError
    ) {
      return logFailedOrderCreation(
        'payment_verification_failed',
        error.status,
        error.message
      )
    }
    throw error
  } finally {
    logPerformance({
      operation: PAYMENT_VERIFY_OPERATION,
      duration: Date.now() - startedAt,
      metadata: { provider: payment.provider },
    })
  }
}

const ensurePaymentTransactionUnique = async (paymentTransactionId: string) => {
  const existingOrder =
    await db.orders.findFirstByPaymentTransactionId(paymentTransactionId)

  if (existingOrder) {
    return logFailedOrderCreation(
      'duplicate_payment_transaction',
      409,
      `Order already exists for payment transaction ${paymentTransactionId}`
    )
  }
}

const getHydratedOrderOrThrow = async (
  orderId: string
): Promise<HydratedOrder> => {
  const fullOrder = await db.orders.findFirstById(orderId)

  if (!fullOrder) {
    throw new OrderRequestError('Failed to retrieve created order', 500)
  }

  return fullOrder as HydratedOrder
}

/**
 * Project a hydrated order into the Redis mirror shape and write it.
 *
 * Only used by the fallback path now — the `index-order-for-search` function
 * owns the mirror on the happy path, where a failure is retried instead of
 * silently desynchronising search from Postgres.
 */
const mirrorOrderToRedis = ({
  hydratedOrder,
  userId,
}: {
  hydratedOrder: HydratedOrder
  userId: string
}): Promise<void> =>
  writeOrderToRedis({
    id: hydratedOrder.id,
    userId,
    customerName: hydratedOrder.customerName,
    customerEmail: hydratedOrder.customerEmail,
    customerAddress: hydratedOrder.customerAddress,
    total: hydratedOrder.totalAmount,
    status: hydratedOrder.status,
    items: hydratedOrder.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price: item.price,
      customizationNote: item.customizationNote ?? null,
    })),
    createdAt: hydratedOrder.createdAt.toISOString(),
    productNames: [
      ...new Set(hydratedOrder.items.map((item) => item.product.name)),
    ].join(', '),
  })

const logOrderCreated = ({
  hydratedOrder,
}: {
  hydratedOrder: HydratedOrder
}) => {
  logBusinessEvent({
    event: 'order_created',
    details: {
      orderId: hydratedOrder.id,
      totalAmount: hydratedOrder.totalAmount,
      itemCount: hydratedOrder.items.length,
      customerEmail: hydratedOrder.customerEmail,
    },
    success: true,
  })
}

/**
 * Recompute the order discount server-side from the submitted coupon code and
 * the database-priced cart lines.
 */
const resolveOrderDiscount = async ({
  body,
  userId,
  productList,
  shippingAmount,
}: {
  body: CreateOrderInput
  userId: string
  productList: ProductWithVariants[]
  shippingAmount: number
}) => {
  const productMap = new Map(
    productList.map((product) => [product.id, product])
  )

  const discountItems: DiscountCartItem[] = body.items.map((item) => {
    const product = productMap.get(item.productId)
    const variant = product?.variants.find(
      (candidate) => candidate.id === item.variantId
    )

    return {
      productId: item.productId,
      category: product?.category ?? '',
      quantity: item.quantity,
      unitPrice: variant?.price ?? 0,
    }
  })

  const codes = body.couponCode?.trim() ? [body.couponCode] : []

  try {
    return await resolveCartDiscount({
      codes,
      items: discountItems,
      userId,
      shippingAmount,
    })
  } catch (error) {
    if (isCouponError(error)) {
      return logFailedOrderCreation(
        'coupon_rejected',
        error.status,
        error.message
      )
    }
    throw error
  }
}

interface CreateOrderForUserInput {
  body: CreateOrderInput
  user: OrderSessionUser
  checkoutRequestId?: string
}

const runOrderCreation = async ({
  body,
  user,
  checkoutRequestId,
}: CreateOrderForUserInput) => {
  const { customerDetails, requestedProductIds } = validateOrderInput({
    body,
    user,
  })
  const productList = await fetchProductsForOrder(requestedProductIds)
  const stockResult = priceAndValidateStock(body.items, productList)
  if (!stockResult.valid) {
    logFailedOrderCreation(
      stockResult.reason,
      stockResult.status,
      stockResult.error,
      stockResult.details
    )
  }
  const { pricedItems } = stockResult as Extract<
    StockCheckResult,
    { valid: true }
  >
  const totals = calculateOrderTotals({
    items: pricedItems,
    destination: {
      state: customerDetails.state,
      pinCode: customerDetails.pinCode,
    },
    shippingMethod: toShippingMethod(body.shippingMethod),
  })
  // Discounts are always recomputed here from the coupon code plus
  // database-priced line items — a client-supplied total is never trusted.
  const discount = await resolveOrderDiscount({
    body,
    userId: user.id,
    productList,
    shippingAmount: totals.shipping.amount,
  })
  // The discount can never push the charged amount below zero.
  const totalAmount = Math.max(
    0,
    roundMoney(totals.total - discount.discountAmount)
  )
  const verifiedPayment = await verifyPaymentForOrder({
    payment: body.payment,
    expectedAmount: totalAmount,
    reference: checkoutRequestId,
  })
  if (verifiedPayment) {
    await ensurePaymentTransactionUnique(verifiedPayment.paymentTransactionId)
  }
  const order = await persistOrder({
    body,
    userId: user.id,
    customerDetails,
    productList,
    totals,
    totalAmount,
    discountAmount: discount.discountAmount,
    appliedCoupons: discount.appliedCoupons,
    verifiedPayment,
    checkoutRequestId,
  })
  const hydratedOrder = await getHydratedOrderOrThrow(order.id)
  logOrderCreated({ hydratedOrder })
  await invalidateOrderRelatedCaches({ userId: user.id, items: body.items })
  await dispatchOrderNotifications({
    hydratedOrder,
    userId: user.id,
    checkoutRequestId,
  })
  return serializeCreatedOrder(hydratedOrder)
}

/**
 * Create an order, timing the whole pipeline.
 *
 * Payment verification and persistence stay inside one call on purpose: "money
 * confirmed" and "order exists" must either both happen or neither, and the
 * caller's compare-and-swap claim makes a retry from the top safe. The timing
 * around it feeds `application_order_processing_duration_ms` so the pipeline's
 * real p95/p99 is measurable before any restructuring is considered.
 */
export const createOrderForUser = async (input: CreateOrderForUserInput) => {
  const startedAt = Date.now()
  let outcome = 'created'

  try {
    return await runOrderCreation(input)
  } catch (error) {
    outcome = 'failed'
    throw error
  } finally {
    logPerformance({
      operation: ORDER_CREATE_OPERATION,
      duration: Date.now() - startedAt,
      metadata: {
        outcome,
        itemCount: input.body.items.length,
        paymentProvider: input.body.payment?.provider ?? 'none',
        checkoutRequestId: input.checkoutRequestId,
      },
    })
  }
}
