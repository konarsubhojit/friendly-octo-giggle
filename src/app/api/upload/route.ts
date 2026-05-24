import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  isValidImageType,
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from '@/lib/upload-constants'
import { logError } from '@/lib/logger'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { type ImageStorageProvider, uploadImage } from '@/lib/image-storage'

// The Azure Blob upload path in `image-storage.ts` depends on Node.js APIs
// (`Buffer`, `@azure/storage-blob` stream handling) that are not available on
// the Edge runtime. Pin this route to the Node.js runtime so deployments on
// Vercel (or any platform that might default to Edge) don't fail at runtime.
export const runtime = 'nodejs'

const MAGIC_BYTE_READ_LENGTH = 16
const MAX_FORM_DATA_BODY_SIZE = MAX_FILE_SIZE + 1024 * 1024

const UploadFormFieldsSchema = z.object({
  provider: z
    .preprocess(
      (value) =>
        value === null || value === undefined || value === ''
          ? undefined
          : value,
      z.enum(['vercel', 'azure']).optional()
    )
    .optional(),
  azureAccountAlias: z
    .preprocess(
      (value) =>
        value === null || value === undefined
          ? undefined
          : typeof value === 'string'
            ? value.trim()
            : value,
      z.string().min(1).optional()
    )
    .optional(),
})

type ValidatedImage = {
  readonly mimeType: string
  readonly extension: 'jpg' | 'png' | 'gif' | 'webp'
}

const getValidatedImageByMagicBytes = (
  bytes: Uint8Array
): ValidatedImage | null => {
  if (bytes.length < 12) return null

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' }
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mimeType: 'image/png', extension: 'png' }
  }

  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    ((bytes[4] === 0x37 && bytes[5] === 0x61) ||
      (bytes[4] === 0x39 && bytes[5] === 0x61))
  ) {
    return { mimeType: 'image/gif', extension: 'gif' }
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp' }
  }

  return null
}

const getRequestBodySize = (request: Request): number | null => {
  const contentLengthHeader = request.headers.get('content-length')
  if (!contentLengthHeader) return null

  const parsed = Number.parseInt(contentLengthHeader, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export async function POST(request: Request) {
  let fileName = 'unknown'
  let userId = 'unknown'
  let provider: ImageStorageProvider | 'unknown' = 'unknown'
  let azureAccountAlias = 'unknown'

  try {
    const authCheck = await checkAdminAuth()
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
    const azureAccountAliasInput = formData.get('azureAccountAlias')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const parseResult = UploadFormFieldsSchema.safeParse({
      provider: providerInput,
      azureAccountAlias: azureAccountAliasInput,
    })
    if (!parseResult.success) {
      const hasProviderError = parseResult.error.issues.some(
        (issue) => issue.path[0] === 'provider'
      )
      const hasAzureAccountAliasError = parseResult.error.issues.some(
        (issue) => issue.path[0] === 'azureAccountAlias'
      )
      if (hasProviderError) {
        return NextResponse.json(
          { error: 'Invalid provider. Expected "vercel" or "azure".' },
          { status: 400 }
        )
      }
      if (hasAzureAccountAliasError) {
        return NextResponse.json(
          { error: 'Invalid azureAccountAlias. Expected a non-empty string.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Invalid upload form fields.' },
        { status: 400 }
      )
    }

    const validatedFormFields = parseResult.data
    const requestedProvider = validatedFormFields.provider
    const requestedAzureAccountAlias = validatedFormFields.azureAccountAlias

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        },
        { status: 400 }
      )
    }

    const imageHeader = new Uint8Array(
      await file.slice(0, MAGIC_BYTE_READ_LENGTH).arrayBuffer()
    )
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
      azureAccountAlias: requestedAzureAccountAlias,
    })
    provider = uploaded.provider
    azureAccountAlias = uploaded.azureAccountAlias ?? 'n/a'

    return NextResponse.json({
      success: true,
      data: {
        url: uploaded.url,
        pathname: uploaded.pathname,
        contentType: uploaded.contentType,
        provider: uploaded.provider,
        azureAccountAlias: uploaded.azureAccountAlias ?? null,
      },
    })
  } catch (error) {
    logError({
      error,
      context: 'file_upload',
      additionalInfo: { fileName, userId, provider, azureAccountAlias },
    })
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
