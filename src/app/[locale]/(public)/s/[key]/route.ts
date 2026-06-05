import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
): Promise<NextResponse> => {
  const { key } = await params

  const share = await db.shares.resolve(key)

  if (!share) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const destination = share.variantId
    ? `/products/${share.productId}?v=${share.variantId}`
    : `/products/${share.productId}`

  return NextResponse.redirect(new URL(destination, request.url))
}
