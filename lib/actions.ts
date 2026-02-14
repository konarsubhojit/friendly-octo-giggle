'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
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
import type { Product, Order } from '@/lib/types';

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
    const product = await prisma.product.create({
      data: validated,
    });

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
    const product = await prisma.product.update({
      where: { id },
      data: validated,
    });

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
    await prisma.product.delete({
      where: { id },
    });

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
): Promise<AsyncResult<Order, string>> {
  try {
    // Validate input
    const validated = CreateOrderSchema.parse(data);

    // Get product IDs and verify existence
    const productIds = validated.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== validated.items.length) {
      return { success: false, error: 'Some products not found' };
    }

    // Check stock and calculate total
    let totalAmount = 0;
    for (const item of validated.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return { success: false, error: `Product ${item.productId} not found` };
      }
      if (product.stock < item.quantity) {
        return { success: false, error: `Insufficient stock for ${product.name}` };
      }
      totalAmount += product.price * item.quantity;
    }

    // Create order and update stock in transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          customerName: validated.customerName,
          customerEmail: validated.customerEmail,
          customerAddress: validated.customerAddress,
          totalAmount,
          status: 'PENDING',
          items: {
            create: validated.items.map((item) => {
              const product = products.find((p) => p.id === item.productId)!;
              return {
                productId: item.productId,
                quantity: item.quantity,
                price: product.price,
              };
            }),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Update product stock
      for (const item of validated.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
          },
        });
      }

      return newOrder;
    });

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
): Promise<AsyncResult<Order, string>> {
  try {
    // Verify admin token
    if (adminToken !== process.env.ADMIN_TOKEN) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate status
    UpdateOrderStatusSchema.parse({ status });

    // Update order
    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

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
