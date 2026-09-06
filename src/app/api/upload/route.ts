import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  isValidImageType,
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from '@/lib/upload-constants'
import {
  MAX_FORM_DATA_BODY_SIZE,
  getRequestBodySize,
  getValidatedImageByMagicBytes,
  readMagicBytes,
} from '@/lib/upload-validation'
import { logError } from '@/lib/logger'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { type ImageStorageProvider, uploadImage } from '@/lib/image-storage'

// The storage adapters in `@/lib/storage` (R2 via `@aws-sdk/client-s3`,
// Vercel via `@vercel/blob`) depend on Node.js APIs (`Buffer`) that are not
// available on the Edge runtime. Node.js is the default runtime for App
// Router route handlers, so no `runtime` segment config is needed — and
// Cache Components rejects one. Any future change that opts this route into
// the Edge runtime would break both storage providers.

const UploadFormFieldsSchema = z.object({
  provider: z
    .preprocess(
      (value) =>
        value === null || value === undefined || value === ''
          ? undefined
          : value,
      z.enum(['vercel', 'r2']).optional()
    )
    .optional(),
})

export async function POST(request: Request) {
  let fileName = 'unknown'
  let userId = 'unknown'
  let provider: ImageStorageProvider | 'unknown' = 'unknown'

  try {
    const authCheck = await checkAdminAuth('products:write')
    userId = authCheck.authorized ? authCheck.userId : 'unknown'
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      )
    }

    const requestBodySize = getRequestBodySize(request)
    if (requestBodySize !== null && requestBodySize > MAX_FORM_DATA_BODY_SIZE) {
      return NextResponse.json(
        {
          error: `Request body too large. Maximum size is ${MAX_FORM_DATA_BODY_SIZE / 1024 / 1024}MB.`,
        },
        { status: 413 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const providerInput = formData.get('provider')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const parseResult = UploadFormFieldsSchema.safeParse({
      provider: providerInput,
    })
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid provider. Expected "vercel" or "r2".' },
        { status: 400 }
      )
    }

    const requestedProvider = parseResult.data.provider

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        },
        { status: 400 }
      )
    }

    const imageHeader = await readMagicBytes(file)
    const validatedImage = getValidatedImageByMagicBytes(imageHeader)

    if (!validatedImage || !isValidImageType(validatedImage.mimeType)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Only ${VALID_IMAGE_TYPES_DISPLAY} are allowed.`,
        },
        { status: 400 }
      )
    }

    provider = requestedProvider ?? 'unknown'

    const sanitizedFile = new File(
      [file],
      `${crypto.randomUUID()}.${validatedImage.extension}`,
      {
        type: validatedImage.mimeType,
        lastModified: file.lastModified,
      }
    )
    fileName = sanitizedFile.name

    const uploaded = await uploadImage(sanitizedFile, {
      provider: requestedProvider,
    })
    provider = uploaded.provider

    return NextResponse.json({
      success: true,
      data: {
        url: uploaded.url,
        pathname: uploaded.pathname,
        contentType: uploaded.contentType,
        provider: uploaded.provider,
      },
    })
  } catch (error) {
    logError({
      error,
      context: 'file_upload',
      additionalInfo: { fileName, userId, provider },
    })
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
