'use server';

import { revalidatePath } from 'next/cache';
import { drizzleDb } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { invalidateCache } from '@/lib/redis';
import {
  ProductInputSchema,
  ProductUpdateSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  type AsyncResult,
  type ProductInput,
  type CreateOrderInput,
  type OrderStatusType,
} from '@/lib/validations';
import type { Product } from '@/lib/types';

// Server Action for creating a product (admin only)
export async function createProductAction(
  data: ProductInput,
  adminToken: string
): Promise<AsyncResult<Product, string>> {
  try {
    // Verify admin token
    if (adminToken !== process.env.ADMIN_TOKEN) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validated = ProductInputSchema.parse(data);

    // Create product
    const [product] = await drizzleDb
      .insert(schema.products)
      .values(validated)
      .returning();

    // Invalidate cache
    await invalidateCache('products:*');

    // Revalidate pages
    revalidatePath('/');
    revalidatePath('/admin');

    return {
      success: true,
      data: {
        ...product,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create product',
    };
  }
}

// Server Action for updating a product (admin only)
export async function updateProductAction(
  id: string,
  data: Partial<ProductInput>,
  adminToken: string
): Promise<AsyncResult<Product, string>> {
  try {
    // Verify admin token
    if (adminToken !== process.env.ADMIN_TOKEN) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validated = ProductUpdateSchema.parse(data);

    // Update product
    const [product] = await drizzleDb
      .update(schema.products)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    // Invalidate cache
    await invalidateCache('products:*');
    await invalidateCache(`product:${id}`);

    // Revalidate pages
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath(`/products/${id}`);

    return {
      success: true,
      data: {
        ...product,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update product',
    };
  }
}

// Server Action for deleting a product (admin only)
export async function deleteProductAction(
  id: string,
  adminToken: string
): Promise<AsyncResult<boolean, string>> {
  try {
    // Verify admin token
    if (adminToken !== process.env.ADMIN_TOKEN) {
      return { success: false, error: 'Unauthorized' };
    }

    // Delete product
    await drizzleDb
      .delete(schema.products)
      .where(eq(schema.products.id, id));

    // Invalidate cache
    await invalidateCache('products:*');
    await invalidateCache(`product:${id}`);

    // Revalidate pages
    revalidatePath('/');
    revalidatePath('/admin');

    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete product',
    };
  }
}

// Server Action for creating an order
export async function createOrderAction(
  data: CreateOrderInput
): Promise<AsyncResult<{
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: OrderStatusType;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: number;
    product: Product;
  }>;
}, string>> {
  try {
    // Validate input
    const validated = CreateOrderSchema.parse(data);

    // Get product IDs and verify existence
    const productIds = validated.items.map((item) => item.productId);
    const products = await drizzleDb.query.products.findMany({
      where: inArray(schema.products.id, productIds),
      with: { variations: true },
    });

    // Infer product type from query result
    type ProductType = (typeof products)[number];

    if (products.length !== validated.items.length) {
      return { success: false, error: 'Some products not found' };
    }

    // Check stock and calculate total
    let totalAmount = 0;
    for (const item of validated.items) {
      const product = products.find((p: ProductType) => p.id === item.productId);
      if (!product) {
        return { success: false, error: `Product ${item.productId} not found` };
      }
      if (product.stock < item.quantity) {
        return { success: false, error: `Insufficient stock for ${product.name}` };
      }
      totalAmount += product.price * item.quantity;
    }

    // Create order and update stock in transaction
    const newOrderId = await drizzleDb.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(schema.orders)
        .values({
          customerName: validated.customerName,
          customerEmail: validated.customerEmail,
          customerAddress: validated.customerAddress,
          totalAmount,
          status: 'PENDING',
        })
        .returning();

      // Insert order items
      await tx.insert(schema.orderItems).values(
        validated.items.map((item) => {
          const product = products.find((p: ProductType) => p.id === item.productId)!;
          return {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: product.price,
          };
        })
      );

      // Update product stock
      for (const item of validated.items) {
        await tx
          .update(schema.products)
          .set({ stock: sql`${schema.products.stock} - ${item.quantity}` })
          .where(eq(schema.products.id, item.productId));
      }

      return newOrder.id;
    });

    // Re-fetch the order with items and product details
    const order = await drizzleDb.query.orders.findFirst({
      where: eq(schema.orders.id, newOrderId),
      with: {
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: 'Failed to retrieve created order' };
    }

    // Invalidate product cache
    await invalidateCache('products:*');
    for (const item of validated.items) {
      await invalidateCache(`product:${item.productId}`);
    }

    // Revalidate pages
    revalidatePath('/');
    revalidatePath('/admin');

    return {
      success: true,
      data: {
        id: order.id,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerAddress: order.customerAddress,
        totalAmount: order.totalAmount,
        status: order.status as OrderStatusType,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          product: {
            ...item.product,
            createdAt: item.product.createdAt.toISOString(),
            updatedAt: item.product.updatedAt.toISOString(),
          },
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
    };
  }
}

// Server Action for updating order status (admin only)
export async function updateOrderStatusAction(
  id: string,
  status: OrderStatusType,
  adminToken: string
): Promise<AsyncResult<{
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: OrderStatusType;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: number;
    product: Product;
  }>;
}, string>> {
  try {
    // Verify admin token
    if (adminToken !== process.env.ADMIN_TOKEN) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate status
    UpdateOrderStatusSchema.parse({ status });

    // Update order
    await drizzleDb
      .update(schema.orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.orders.id, id))
      .returning();

    // Re-fetch order with items and product details
    const order = await drizzleDb.query.orders.findFirst({
      where: eq(schema.orders.id, id),
      with: {
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Revalidate admin page
    revalidatePath('/admin');

    return {
      success: true,
      data: {
        id: order.id,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerAddress: order.customerAddress,
        totalAmount: order.totalAmount,
        status: order.status as OrderStatusType,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          product: {
            ...item.product,
            createdAt: item.product.createdAt.toISOString(),
            updatedAt: item.product.updatedAt.toISOString(),
          },
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update order status',
    };
  }
}
