import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/redis';
import { ProductUpdateSchema } from '@/lib/validations';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Check if user is admin
async function checkAdminAuth() {
  const session = await auth();
  
  if (!session?.user) {
    return { authorized: false, error: 'Not authenticated', status: 401 as const };
  }
  
  if (session.user.role !== 'ADMIN') {
    return { authorized: false, error: 'Not authorized - Admin access required', status: 403 as const };
  }
  
  return { authorized: true };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
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
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
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
