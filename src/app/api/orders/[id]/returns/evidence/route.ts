import { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import { auth } from '@/lib/auth'
import { primaryDrizzleDb } from '@/lib/db'
import { orders, returnEvidence } from '@/lib/schema'
import { uploadImage } from '@/lib/image-storage'
import {
  MAX_FORM_DATA_BODY_SIZE,
  getRequestBodySize,
  validateUploadedImage,
} from '@/lib/upload-validation'
import {
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from '@/lib/upload-constants'
import { RETURN_EVIDENCE_MAX } from '@/lib/constants/returns'
import { INSTAGRAM_HANDLE } from '@/lib/constants/store'
import { countOrphanedEvidence } from '@/features/orders/services/return-service'
import { logError } from '@/lib/logger'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

/**
 * Upload one evidence photo for a damaged-item claim.
 *
 * The row is created **orphaned** — `returnRequestId` stays null until the
 * claim itself is submitted and attaches it. That is why `userId` and
 * `orderId` are stored here: they carry ownership and scope during the window
 * where there is no parent row to join through, and they are what makes the
 * per-order cap queryable.
 *
 * Images only. The policy also asks for a short video; that is sent over
 * Instagram DM and never touches this route, so a video upload is rejected
 * with a message that says where to send it rather than a bare type error.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const { id: orderId } = await params
    const userId = session.user.id

    const bodySize = getRequestBodySize(request)
    if (bodySize !== null && bodySize > MAX_FORM_DATA_BODY_SIZE) {
      return apiError(
        `Request body too large. Maximum size is ${MAX_FORM_DATA_BODY_SIZE / 1024 / 1024}MB.`,
        413
      )
    }

    // Ownership first: an upload against somebody else's order is reported as
    // missing, not forbidden, so this cannot be used to probe for order ids.
    const [order] = await primaryDrizzleDb
      .select({ id: orders.id, userId: orders.userId })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .limit(1)

    if (!order) {
      return apiError('Order not found', 404)
    }

    const orphaned = await countOrphanedEvidence(userId, orderId)
    if (orphaned >= RETURN_EVIDENCE_MAX) {
      return apiError(
        `You can attach at most ${RETURN_EVIDENCE_MAX} photos to a return`,
        409
      )
    }

    const formData = await request.formData()
    const validation = await validateUploadedImage(formData.get('file'))

    if (!validation.ok) {
      return apiError(
        describeUploadFailure(validation.failure.kind),
        validation.failure.status
      )
    }

    const uploaded = await uploadImage(validation.file)

    const [created] = await primaryDrizzleDb
      .insert(returnEvidence)
      .values({
        returnRequestId: null,
        userId,
        orderId,
        url: uploaded.url,
        pathname: uploaded.pathname,
        contentType: uploaded.contentType,
        provider: uploaded.provider,
      })
      .returning({ id: returnEvidence.id })

    return apiSuccess(
      {
        id: created.id,
        url: uploaded.url,
        contentType: uploaded.contentType,
        provider: uploaded.provider,
      },
      201,
      PRIVATE_HEADERS
    )
  } catch (error) {
    logError({ error, context: 'return_evidence_upload' })
    return handleApiError(error)
  }
}

const describeUploadFailure = (
  kind:
    | 'body_too_large'
    | 'file_too_large'
    | 'missing_file'
    | 'unsupported_type'
): string => {
  switch (kind) {
    case 'missing_file':
      return 'A photo of the damage is required'
    case 'file_too_large':
    case 'body_too_large':
      return `Photo is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    case 'unsupported_type':
      // Videos land here. Say where they go rather than only what is wrong.
      return `Only ${VALID_IMAGE_TYPES_DISPLAY} photos can be uploaded here. To send a video, message @${INSTAGRAM_HANDLE} on Instagram with your return ID.`
  }
}
