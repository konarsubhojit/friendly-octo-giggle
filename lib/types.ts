export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  images: string[];
  stock: number;
  category: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  variations?: ProductVariation[];
}

export interface ProductVariation {
  id: string;
  productId: string;
  name: string;
  designName: string;
  variationType: "styling" | "colour";
  image: string | null;
  images: string[];
  price: number;
  stock: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  image: string;
  images?: string[];
  stock: number;
  category: string;
}

export enum OrderStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export interface OrderItem {
  productId: string;
  variationId?: string;
  quantity: number;
  price: number;
  customizationNote?: string | null;
}

export interface OrderItemInput {
  productId: string;
  variationId?: string;
  quantity: number;
  customizationNote?: string | null;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: OrderStatus;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemWithProduct[];
}

export interface OrderItemWithProduct {
  id: string;
  productId: string;
  variationId?: string | null;
  quantity: number;
  price: number;
  customizationNote?: string | null;
  product: Product;
  variation?: ProductVariation | null;
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  items: OrderItemInput[];
}

export type CheckoutRequestStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface CheckoutEnqueueResponse {
  checkoutRequestId: string;
  status: CheckoutRequestStatus;
}

export interface CheckoutRequestStatusResponse extends CheckoutEnqueueResponse {
  orderId: string | null;
  error: string | null;
}

export interface Cart {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  items: CartItemWithProduct[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variationId?: string | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItemWithProduct extends CartItem {
  product: Product;
  variation?: ProductVariation | null;
}

export interface AddToCartInput {
  productId: string;
  variationId?: string | null;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

// ─── Review Types ─────────────────────────────────────────

export interface Review {
  id: string;
  productId: string;
  orderId: string | null;
  userId: string | null;
  rating: number;
  comment: string;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { name: string | null; image: string | null } | null;
  product?: { id: string; name: string; image: string } | null;
}

export interface CreateReviewInput {
  productId: string;
  orderId?: string | null;
  rating: number;
  comment: string;
  isAnonymous?: boolean;
}

// ─── Wishlist Types ──────────────────────────────────────

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
  product: Product;
}

export interface AddToWishlistInput {
  productId: string;
}
