import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/redis';
import { ProductUpdateSchema } from '@/lib/validations';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Simple authentication middleware
function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (!adminToken) {
    console.warn('ADMIN_TOKEN not set');
    return false;
  }
  
  return authHeader === `Bearer ${adminToken}`;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return apiError('Unauthorized', 401);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate input with Zod
    const validated = ProductUpdateSchema.parse(body);
    
    const product = await db.products.update(id, validated);
    
    if (!product) {
      return apiError('Product not found', 404);
    }
    
    // Invalidate cache
    await invalidateCache('products:*');
    await invalidateCache(`product:${id}`);
    
    return apiSuccess({ product });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return apiError('Unauthorized', 401);
  }

  try {
    const { id } = await params;
    const success = await db.products.delete(id);
    
    if (!success) {
      return apiError('Product not found', 404);
    }
    
    // Invalidate cache
    await invalidateCache('products:*');
    await invalidateCache(`product:${id}`);
    
    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
