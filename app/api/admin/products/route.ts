import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/redis';
import { ProductInputSchema } from '@/lib/validations';
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

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return apiError('Unauthorized', 401);
  }

  try {
    const products = await db.products.findAll();
    return apiSuccess({ products });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return apiError('Unauthorized', 401);
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
