import { db, StockConflictError } from '@/lib/db'
import { formatStructuredAddress } from '@/lib/address-utils'
import { invalidateCache } from '@/lib/redis'
import { invalidateUserOrderCaches } from '@/lib/cache'
import { CreateOrderInput, OrderItemInput } from '@/lib/types'
import { logBusinessEvent, logError } from '@/lib/logger'
import { sendOrderConfirmationEmail } from '@/lib/email'
import type { OrderCreatedEvent } from '@/lib/qstash-events'
import { getQStashClient } from '@/lib/qstash'
import { env } from '@/lib/env'
import { waitUntil } from '@vercel/functions'
import { writeOrderToRedis } from '@/features/orders/actions/orders'
import {
  formatPriceForCurrency,
  isValidCurrencyCode,
  type CurrencyCode,
} from '@/lib/currency'
import { isSupportedLocale } from '@/lib/i18n/config'
import {
  PaymentConfigurationError,
  PaymentVerificationError,
  verifyCheckoutPayment,
} from '@/lib/payments'
import {
  OrderRequestError,
  type OrderSessionUser,
} from './order-service.shared'

type ProductWithVariants = {
  id: string
  name: string
  variants: Array<{ id: string; price: number; stock: number }>
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
  | { valid: true; totalAmount: number }
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
  totalAmount: number
  status: string
  paymentStatus: string
  createdAt: Date
  updatedAt: Date
  items: HydratedOrderItem[]
}

export interface OrderNotificationPublisher {
  publishOrderCreated: (input: {
    url: string
    event: OrderCreatedEvent
  }) => Promise<{ messageId?: string }>
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

const checkStockForItem = (
  item: OrderItemInput,
  product: ProductWithVariants
): StockCheckResult => {
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

  return { valid: true, totalAmount: price * item.quantity }
}

const validateStockAndCalculateTotal = (
  items: OrderItemInput[],
  productList: ProductWithVariants[]
): StockCheckResult => {
  let totalAmount = 0
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
    totalAmount += result.totalAmount
  }

  return { valid: true, totalAmount }
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

const getDefaultNotificationPublisher = (): OrderNotificationPublisher => ({
  publishOrderCreated: async ({ url, event }) =>
    getQStashClient().publishJSON({
      url,
      body: event,
    }),
})

const getDefaultOrderCacheInvalidator = (): OrderCacheInvalidator => ({
  invalidateOrderCaches: async ({ userId, productIds }) => {
    const uniqueProductIds = [...new Set(productIds)]
    await Promise.all([
      invalidateCache('admin:orders:*'),
      invalidateUserOrderCaches(userId),
      ...uniqueProductIds.map((productId) =>
        invalidateCache(`product:${productId}`)
      ),
    ])
  },
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
  totalAmount,
  verifiedPayment,
  checkoutRequestId,
}: {
  body: CreateOrderInput
  userId: string
  customerDetails: Extract<ValidationResult, { valid: true }>
  productList: ProductWithVariants[]
  totalAmount: number
  verifiedPayment: {
    provider: 'RAZORPAY'
    paymentOrderId: string
    paymentTransactionId: string
    amountPaid: number
    paidAt: Date
  }
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
      totalAmount,
      verifiedPayment,
      items: buildOrderItemValues(body.items, productList),
    })
  } catch (err) {
    if (err instanceof StockConflictError) {
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

export const dispatchOrderNotifications = async ({
  hydratedOrder,
  userId,
  publisher = getDefaultNotificationPublisher(),
}: {
  hydratedOrder: HydratedOrder
  userId: string
  publisher?: OrderNotificationPublisher
}) => {
  const workerUrl = `${env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/services/email`
  const userRecord = await db.users.findPreferences(userId)
  const currencyCode: CurrencyCode =
    userRecord?.currencyPreference &&
    isValidCurrencyCode(userRecord.currencyPreference)
      ? userRecord.currencyPreference
      : 'INR'
  const locale =
    userRecord?.localePreference &&
    isSupportedLocale(userRecord.localePreference)
      ? userRecord.localePreference
      : 'en'

  const emailEvent: OrderCreatedEvent = {
    type: 'order.created',
    data: {
      orderId: hydratedOrder.id,
      customerEmail: hydratedOrder.customerEmail,
      customerName: hydratedOrder.customerName,
      customerAddress: hydratedOrder.customerAddress,
      totalAmount: hydratedOrder.totalAmount,
      currencyCode,
      locale,
      items: hydratedOrder.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
      })),
    },
  }

  try {
    const publishResult = await publisher.publishOrderCreated({
      url: workerUrl,
      event: emailEvent,
    })
    logBusinessEvent({
      event: 'order_email_queued',
      details: {
        orderId: hydratedOrder.id,
        eventType: emailEvent.type,
        messageId: publishResult.messageId,
      },
      success: true,
    })
  } catch (publishError) {
    logError({
      error: publishError,
      context: 'qstash_publish_failed_using_fallback',
      additionalInfo: {
        orderId: hydratedOrder.id,
        eventType: emailEvent.type,
      },
    })
    sendOrderConfirmationEmail({
      to: hydratedOrder.customerEmail,
      customerName: hydratedOrder.customerName,
      orderId: hydratedOrder.id,
      totalAmount: formatPriceForCurrency(
        hydratedOrder.totalAmount,
        currencyCode
      ),
      shippingAddress: hydratedOrder.customerAddress,
      locale,
      items: hydratedOrder.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: formatPriceForCurrency(item.price, currencyCode),
        variant: null,
      })),
    })
  }
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

const verifyPaymentForOrder = async ({
  payment,
  expectedAmount,
}: {
  payment: CreateOrderInput['payment']
  expectedAmount: number
}) => {
  try {
    return await verifyCheckoutPayment({ payment, expectedAmount })
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

const logAndQueueOrderRecord = ({
  hydratedOrder,
  userId,
}: {
  hydratedOrder: HydratedOrder
  userId: string
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

  waitUntil(
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
  )
}

export const createOrderForUser = async ({
  body,
  user,
  checkoutRequestId,
}: {
  body: CreateOrderInput
  user: OrderSessionUser
  checkoutRequestId?: string
}) => {
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
  const totalAmount = (
    stockResult as Extract<StockCheckResult, { valid: true }>
  ).totalAmount
  const verifiedPayment = await verifyPaymentForOrder({
    payment: body.payment,
    expectedAmount: totalAmount,
  })
  await ensurePaymentTransactionUnique(verifiedPayment.paymentTransactionId)
  const order = await persistOrder({
    body,
    userId: user.id,
    customerDetails,
    productList,
    totalAmount,
    verifiedPayment,
    checkoutRequestId,
  })
  const hydratedOrder = await getHydratedOrderOrThrow(order.id)
  logAndQueueOrderRecord({ hydratedOrder, userId: user.id })
  await invalidateOrderRelatedCaches({ userId: user.id, items: body.items })
  await dispatchOrderNotifications({ hydratedOrder, userId: user.id })
  return serializeCreatedOrder(hydratedOrder)
}
