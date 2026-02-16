import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/redis';
import { ProductInputSchema } from '@/lib/validations';
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

export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
  }

  try {
    const products = await db.products.findAll();
    return apiSuccess({ products });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
  }

  try {
    const body = await request.json();
    
    // Validate input with Zod
    const validated = ProductInputSchema.parse(body);

    const product = await db.products.create(validated);
    
    // Invalidate cache
    await invalidateCache('products:*');
    
    return apiSuccess({ product }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
