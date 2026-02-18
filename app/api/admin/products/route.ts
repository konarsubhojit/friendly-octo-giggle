import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ProductInputSchema } from '@/lib/validations';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { revalidateTag } from 'next/cache';

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

    // Cache invalidation is handled automatically in db.products.create
    const product = await db.products.create(validated);

    // Revalidate Next.js cache tags (with empty config for immediate revalidation)
    revalidateTag('products', {});

    return apiSuccess({ product }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
