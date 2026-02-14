import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { invalidateCache } from '@/lib/redis';
import { CreateOrderInput, OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: CreateOrderInput = await request.json();
    
    // Validate input
    if (!body.customerName || !body.customerEmail || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate total and verify product/variation availability
    let totalAmount = 0;
    const productIds = body.items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variations: true },
    });

    type ProductWithVariations = (typeof products)[number];

    if (products.length !== body.items.length) {
      return NextResponse.json(
        { error: 'Some products not found' },
        { status: 404 }
      );
    }

    // Check stock and calculate total
    for (const item of body.items) {
      const product = products.find((p: ProductWithVariations) => p.id === item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 404 }
        );
      }
      
      let price = product.price;
      let stockToCheck = product.stock;
      
      // If variation is selected, use variation price and stock
      if (item.variationId) {
        const variation = product.variations.find((v: ProductWithVariations['variations'][number]) => v.id === item.variationId);
        if (!variation) {
          return NextResponse.json(
            { error: `Variation not found for ${product.name}` },
            { status: 404 }
          );
        }
        price = product.price + variation.priceModifier;
        stockToCheck = variation.stock;
      }
      
      if (stockToCheck < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        );
      }
      
      totalAmount += price * item.quantity;
    }

    // Create order and update stock in a transaction
    const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerAddress: body.customerAddress,
          totalAmount,
          status: OrderStatus.PENDING,
          items: {
            create: body.items.map(item => {
              const product = products.find((p: ProductWithVariations) => p.id === item.productId)!;
              let price = product.price;
              
              if (item.variationId) {
                const variation = product.variations.find((v: ProductWithVariations['variations'][number]) => v.id === item.variationId);
                if (variation) {
                  price = product.price + variation.priceModifier;
                }
              }
              
              return {
                productId: item.productId,
                variationId: item.variationId,
                quantity: item.quantity,
                price,
              };
            }),
          },
        },
        include: {
          items: {
            include: {
              product: true,
              variation: true,
            },
          },
        },
      });

      // Update product/variation stock
      for (const item of body.items) {
        if (item.variationId) {
          // Update variation stock
          await tx.productVariation.update({
            where: { id: item.variationId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });
        }
        
        // Always update total product stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return newOrder;
    });

    // Invalidate product cache
    await invalidateCache('products:*');
    for (const item of body.items) {
      await invalidateCache(`product:${item.productId}`);
    }
    
    // Invalidate order caches
    await invalidateCache('admin:orders:*');

    return NextResponse.json({ 
      order: {
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map(item => ({
          ...item,
          product: {
            ...item.product,
            createdAt: item.product.createdAt.toISOString(),
            updatedAt: item.product.updatedAt.toISOString(),
          },
        })),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
