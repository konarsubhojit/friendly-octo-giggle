import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCachedData } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use Redis cache with stampede prevention
    const products = await getCachedData(
      'products:all',
      60, // Cache for 60 seconds
      async () => {
        return await db.products.findAll();
      },
      10 // Serve stale data for up to 10 extra seconds while revalidating
    );

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
