import { NextRequest } from 'next/server';
import { drizzleDb } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { serializeOrder } from '@/lib/serializers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Authentication required', 401);
    }

    const { id } = await params;

    const order = await drizzleDb.query.orders.findFirst({
      where: eq(schema.orders.id, id),
      with: {
        items: {
          with: {
            product: true,
            variation: true,
          },
        },
      },
    });

    if (order?.userId !== session.user.id) {
      return apiError('Order not found', 404);
    }

    return apiSuccess({ order: serializeOrder(order) });
  } catch (error) {
    return handleApiError(error);
  }
}
