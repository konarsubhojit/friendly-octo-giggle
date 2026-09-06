import { MAX_FILE_SIZE } from '@/lib/upload-constants'

/**
 * Shared upload validation.
 *
 * Extracted from the admin product-image route so the customer return-evidence
 * route can apply the identical checks without inheriting the admin
 * authorization that route carries. The two endpoints have different auth
 * models but must never have different validation — magic-byte sniffing rather
 * than trusting `Content-Type` is what stops a polyglot file being stored and
 * later served as something executable.
 */

const MAGIC_BYTE_READ_LENGTH = 16

/** Largest multipart body accepted, allowing headroom for form overhead. */
export const MAX_FORM_DATA_BODY_SIZE = MAX_FILE_SIZE + 1024 * 1024

export type ValidatedImageExtension = 'jpg' | 'png' | 'gif' | 'webp'

export interface ValidatedImage {
  readonly mimeType: string
  readonly extension: ValidatedImageExtension
}

/**
 * Identify an image by its leading bytes.
 *
 * Returns `null` for anything not a JPEG, PNG, GIF or WebP — including every
 * video container, which is deliberate: video evidence is collected over
 * Instagram DM, never uploaded here.
 */
export const getValidatedImageByMagicBytes = (
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
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
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

/** Read just enough of a file to identify it. */
export const readMagicBytes = async (file: File): Promise<Uint8Array> =>
  new Uint8Array(await file.slice(0, MAGIC_BYTE_READ_LENGTH).arrayBuffer())

/** Declared body size, or `null` when the header is missing or malformed. */
export const getRequestBodySize = (request: Request): number | null => {
  const contentLengthHeader = request.headers.get('content-length')
  if (!contentLengthHeader) return null

  const parsed = Number.parseInt(contentLengthHeader, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export type UploadValidationFailure =
  | { readonly kind: 'body_too_large'; readonly status: 413 }
  | { readonly kind: 'file_too_large'; readonly status: 413 }
  | { readonly kind: 'missing_file'; readonly status: 400 }
  | { readonly kind: 'unsupported_type'; readonly status: 400 }

export type UploadValidationResult =
  | {
      readonly ok: true
      /**
       * Rebuilt with a generated name and the magic-byte-derived type.
       *
       * Never the caller's original `File`. Blob storage derives both the
       * object key and the served `Content-Type` from these fields, so passing
       * the attacker-supplied ones through would let a file whose bytes are a
       * valid GIF — and whose body is also valid HTML — be stored and served as
       * `text/html` from a public origin.
       */
      readonly file: File
      readonly image: ValidatedImage
    }
  | { readonly ok: false; readonly failure: UploadValidationFailure }

/**
 * Validate a single uploaded image: size against `MAX_FILE_SIZE`, then real
 * type by magic bytes. Callers map the failure kind onto their own copy — the
 * return-evidence route, for instance, turns `unsupported_type` into a message
 * pointing at the Instagram video channel rather than a bare type error.
 *
 * On success the returned `file` is sanitized, so no caller can accidentally
 * forward the original filename or declared content type to storage.
 */
export const validateUploadedImage = async (
  file: unknown
): Promise<UploadValidationResult> => {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, failure: { kind: 'missing_file', status: 400 } }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, failure: { kind: 'file_too_large', status: 413 } }
  }

  const image = getValidatedImageByMagicBytes(await readMagicBytes(file))
  if (!image) {
    return { ok: false, failure: { kind: 'unsupported_type', status: 400 } }
  }

  const sanitized = new File(
    [file],
    `${crypto.randomUUID()}.${image.extension}`,
    { type: image.mimeType, lastModified: file.lastModified }
  )

  return { ok: true, file: sanitized, image }
}
