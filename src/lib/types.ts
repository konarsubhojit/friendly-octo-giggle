export interface ProductOptionValue {
  id: string
  optionId: string
  value: string
  sortOrder: number
  createdAt: string
}

export interface ProductOption {
  id: string
  productId: string
  name: string
  sortOrder: number
  createdAt: string
  values: ProductOptionValue[]
}

export interface ProductVariant {
  id: string
  productId: string
  sku: string | null
  price: number
  stock: number
  image: string | null
  images: string[]
  sortOrder?: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  optionValues?: ProductOptionValue[]
}

export interface Product {
  id: string
  name: string
  description: string
  image: string
  images: string[]
  category: string
  soldCount?: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  options?: ProductOption[]
  variants?: ProductVariant[]
}

export interface ProductInput {
  name: string
  description: string
  image: string
  images?: string[]
  category: string
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'

export type PaymentProvider = 'RAZORPAY'

export interface CheckoutPaymentInput {
  provider: PaymentProvider
  orderId: string
  paymentId: string
  signature: string
}

export interface OrderItem {
  productId: string
  variantId: string
  quantity: number
  price: number
  customizationNote?: string | null
}

export interface OrderItemInput {
  productId: string
  variantId: string
  quantity: number
  customizationNote?: string | null
}

export interface StructuredAddress {
  addressLine1: string
  addressLine2?: string | null
  addressLine3?: string | null
  pinCode: string
  city: string
  state: string
}

export interface Order {
  id: string
  customerName: string
  customerEmail: string
  customerAddress: string
  addressLine1?: string | null
  addressLine2?: string | null
  addressLine3?: string | null
  pinCode?: string | null
  city?: string | null
  state?: string | null
  totalAmount: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentProvider?: PaymentProvider | null
  paymentOrderId?: string | null
  paymentTransactionId?: string | null
  amountPaid: number
  paidAt?: string | null
  trackingNumber?: string | null
  shippingProvider?: string | null
  createdAt: string
  updatedAt: string
  items: OrderItemWithProduct[]
}

export interface OrderItemWithProduct {
  id: string
  productId: string
  variantId: string
  quantity: number
  price: number
  customizationNote?: string | null
  product: Product
  variant?: ProductVariant | null
}

export interface CreateOrderInput {
  customerName: string
  customerEmail: string
  customerAddress: string
  addressLine1: string
  addressLine2?: string | null
  addressLine3?: string | null
  pinCode: string
  city: string
  state: string
  items: OrderItemInput[]
  payment: CheckoutPaymentInput
}

export type CheckoutRequestStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'

export interface CheckoutEnqueueResponse {
  checkoutRequestId: string
  status: CheckoutRequestStatus
}

export interface CheckoutRequestStatusResponse extends CheckoutEnqueueResponse {
  orderId: string | null
  error: string | null
}

export interface Cart {
  id: string
  userId?: string | null
  sessionId?: string | null
  items: CartItemWithProduct[]
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  id: string
  cartId: string
  productId: string
  variantId: string
  quantity: number
  createdAt: string
  updatedAt: string
}

export interface CartItemWithProduct extends CartItem {
  product: Product
  variant?: ProductVariant | null
  variantLabel?: string | null
}

export interface AddToCartInput {
  productId: string
  variantId: string
  quantity: number
}

export interface UpdateCartItemInput {
  quantity: number
}

// ─── Review Types ─────────────────────────────────────────

export interface Review {
  id: string
  productId: string
  orderId: string | null
  userId: string | null
  rating: number
  comment: string
  isAnonymous: boolean
  createdAt: string
  updatedAt: string
  user?: { name: string | null; image: string | null } | null
  product?: { id: string; name: string; image: string } | null
}

export interface CreateReviewInput {
  productId: string
  orderId?: string | null
  rating: number
  comment: string
  isAnonymous?: boolean
}

// ─── Wishlist Types ──────────────────────────────────────

export interface WishlistItem {
  id: string
  userId: string
  productId: string
  createdAt: string
  product: Product
}

export interface AddToWishlistInput {
  productId: string
}
