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

// The Azure Blob upload path in `image-storage.ts` depends on Node.js APIs
// (`Buffer`, `@azure/storage-blob` stream handling) that are not available on
// the Edge runtime. Node.js is the default runtime for App Router route
// handlers, so no `runtime` segment config is needed — and Cache Components
// rejects one. Any future change that opts this route into the Edge runtime
// would break the Azure provider.

const normalizeAliasInput = (value: unknown) => {
  if (value === null || value === undefined) return undefined
  return typeof value === 'string' ? value.trim() : value
}

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
    .preprocess(normalizeAliasInput, z.string().min(1).optional())
    .optional(),
})

export async function POST(request: Request) {
  let fileName = 'unknown'
  let userId = 'unknown'
  let provider: ImageStorageProvider | 'unknown' = 'unknown'
  let azureAccountAlias = 'unknown'

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
