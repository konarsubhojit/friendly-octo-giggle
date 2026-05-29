import { auth } from '@/lib/auth'
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { CreateAddressSchema } from '@/features/account/validations'
import {
  createUserAddress,
  listUserAddresses,
} from '@/features/account/services/address-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    const records = await listUserAddresses(session.user.id)
    return apiSuccess({ addresses: records })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    const payload = await parseJsonBody(request, CreateAddressSchema)
    const created = await createUserAddress(session.user.id, payload)
    return apiSuccess({ address: created }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
