export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  stock: number;
  category: string;
  createdAt: string;
  updatedAt: string;
  variations?: ProductVariation[];
}

export interface ProductVariation {
  id: string;
  productId: string;
  name: string;
  designName: string;
  image: string | null;
  priceModifier: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  image: string;
  stock: number;
  category: string;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface OrderItem {
  productId: string;
  variationId?: string;
  quantity: number;
  price: number;
}

// Input type for order items (without price, which is calculated)
export interface OrderItemInput {
  productId: string;
  variationId?: string;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: OrderStatus;
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
  product: Product;
  variation?: ProductVariation | null;
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  items: OrderItemInput[];
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
  variationId?: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}
