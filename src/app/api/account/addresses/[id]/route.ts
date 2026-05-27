import { auth } from '@/lib/auth'
import { apiError, apiSuccess, handleApiError, parseJsonBody } from '@/lib/api-utils'
import { UpdateAddressSchema } from '@/features/account/validations'
import {
  deleteUserAddress,
  updateUserAddress,
} from '@/features/account/services/address-service'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    const payload = await parseJsonBody(request, UpdateAddressSchema)
    const { id } = await params
    const updated = await updateUserAddress({
      userId: session.user.id,
      addressId: id,
      input: payload,
    })

    if (!updated) {
      return apiError('Address not found', 404)
    }

    return apiSuccess({ address: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    const { id } = await params
    const removed = await deleteUserAddress({
      userId: session.user.id,
      addressId: id,
    })

    if (!removed) {
      return apiError('Address not found', 404)
    }

    return apiSuccess({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
