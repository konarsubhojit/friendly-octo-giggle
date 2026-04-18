import { NextResponse } from 'next/server'
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const providerInput = formData.get('provider')
    const azureAccountAliasInput = formData.get('azureAccountAlias')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    fileName = file.name

    if (!isValidImageType(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Only ${VALID_IMAGE_TYPES_DISPLAY} are allowed.`,
        },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        },
        { status: 400 }
      )
    }

    const requestedProvider =
      providerInput === 'vercel' || providerInput === 'azure'
        ? providerInput
        : undefined

    if (providerInput !== null && requestedProvider === undefined) {
      return NextResponse.json(
        { error: 'Invalid provider. Expected "vercel" or "azure".' },
        { status: 400 }
      )
    }
    provider = requestedProvider ?? 'unknown'

    const requestedAzureAccountAlias =
      typeof azureAccountAliasInput === 'string' &&
      azureAccountAliasInput.trim().length > 0
        ? azureAccountAliasInput
        : undefined

    const uploaded = await uploadImage(file, {
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
