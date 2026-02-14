import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCachedData } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Use Redis cache with stampede prevention
    const product = await getCachedData(
      `product:${id}`,
      60, // Cache for 60 seconds
      async () => {
        return await db.products.findById(id);
      },
      10 // Serve stale data for up to 10 extra seconds while revalidating
    );

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}
