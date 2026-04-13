import { type NextRequest } from 'next/server'
import { getIndiaPincode, isValidPincode } from 'india-pincode'
import type { IndiaPincode } from 'india-pincode'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getCachedData } from '@/lib/redis'
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cache'

interface PincodeLookupResult {
  city: string
  state: string
}

// Lazy singleton — only initialized on first request, not at module-eval time.
// This avoids the "data file not found" error during `next build` page collection.
let pincodeInstance: IndiaPincode | null = null

function getPincode(): IndiaPincode {
  if (!pincodeInstance) {
    pincodeInstance = getIndiaPincode()
  }
  return pincodeInstance
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  if (!isValidPincode(code)) {
    return apiError('Invalid pin code format', 400)
  }

  const result = await getCachedData<PincodeLookupResult | null>(
    CACHE_KEYS.PINCODE_LOOKUP(code),
    CACHE_TTL.PINCODE_LOOKUP,
    () => {
      const summary = getPincode().getPincodeSummary(code)

      if (!summary.success || !summary.data) {
        return Promise.resolve(null)
      }

      return Promise.resolve({
        city: summary.data.district,
        state: summary.data.state,
      })
    }
  )

  if (!result) {
    return apiError('Pin code not found', 404)
  }

  return apiSuccess(result, 200, {
    'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
  })
}
