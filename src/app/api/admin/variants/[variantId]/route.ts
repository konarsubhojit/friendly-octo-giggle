import type { NextRequest } from 'next/server'
import {
  PUT as putVariation,
  DELETE as deleteVariation,
} from '@/app/api/admin/variations/[variationId]/route'

export const dynamic = 'force-dynamic'

interface VariantRouteParams {
  readonly params: Promise<{ variantId: string }>
}

const mapVariantParams = (
  params: Promise<{ variantId: string }>
): Promise<{ variationId: string }> =>
  params.then(({ variantId }) => ({ variationId: variantId }))

export function PUT(request: NextRequest, { params }: VariantRouteParams) {
  return putVariation(request, { params: mapVariantParams(params) })
}

export function DELETE(request: NextRequest, { params }: VariantRouteParams) {
  return deleteVariation(request, { params: mapVariantParams(params) })
}
