'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import {
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES,
  VALID_IMAGE_TYPES_DISPLAY,
} from '@/lib/upload-constants'
import { RETURN_EVIDENCE_MAX } from '@/lib/constants/returns'
import { INSTAGRAM_HANDLE } from '@/lib/constants/store'

export interface UploadedEvidence {
  readonly id: string
  readonly url: string
}

interface ReturnEvidenceUploaderProps {
  readonly orderId: string
  readonly evidence: readonly UploadedEvidence[]
  readonly onUploaded: (evidence: UploadedEvidence) => void
  readonly disabled?: boolean
}

/**
 * Collects photos of the damage.
 *
 * Client-side checks here are a courtesy — they save a round trip on obvious
 * mistakes. The server repeats every one of them by magic byte, because
 * anything sent from a browser is untrusted.
 */
export function ReturnEvidenceUploader({
  orderId,
  evidence,
  onUploaded,
  disabled = false,
}: ReturnEvidenceUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const atCapacity = evidence.length >= RETURN_EVIDENCE_MAX

  const handleFile = async (file: File) => {
    setError(null)

    // Videos are the common case here, and a bare "unsupported type" would
    // leave the customer stuck: the policy asks them for a video, so say
    // where it goes rather than only what is wrong.
    if (file.type.startsWith('video/')) {
      setError(
        `Videos cannot be uploaded here. Send yours to @${INSTAGRAM_HANDLE} on Instagram once you have submitted this request — we will show you how.`
      )
      return
    }

    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      setError(`Only ${VALID_IMAGE_TYPES_DISPLAY} photos can be attached.`)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        `That photo is too large. The maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
      )
      return
    }

    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)

      const response = await fetch(`/api/orders/${orderId}/returns/evidence`, {
        method: 'POST',
        body,
      })
      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.error ?? 'That photo could not be uploaded.')
        return
      }

      onUploaded({ id: payload.data.id, url: payload.data.url })
    } catch {
      setError('That photo could not be uploaded. Please try again.')
    } finally {
      setUploading(false)
      // Clear the input so re-selecting the same file fires `change` again.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="block text-sm font-medium text-[var(--foreground)] mb-2">
        Photos of the damage{' '}
        <span className="text-[var(--accent-rose)]" aria-hidden="true">
          *
        </span>
      </legend>

      <p className="text-sm text-[var(--text-secondary)] mb-3">
        At least one photo is required, up to {RETURN_EVIDENCE_MAX}. Our team
        reviews these before approving your claim.
      </p>

      {evidence.length > 0 && (
        <ul className="flex flex-wrap gap-3 mb-3 list-none p-0">
          {evidence.map((item, index) => (
            <li key={item.id}>
              <Image
                src={item.url}
                alt={`Damage evidence ${index + 1}`}
                width={80}
                height={80}
                className="h-20 w-20 rounded-lg object-cover border border-[var(--border-warm)]"
              />
            </li>
          ))}
        </ul>
      )}

      {/* The legend names the group, not the control — without this the only
          required field on the form announces as an unlabelled button. */}
      <label htmlFor={inputId} className="sr-only">
        Upload a photo of the damage
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={VALID_IMAGE_TYPES.join(',')}
        disabled={disabled || uploading || atCapacity}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
        }}
        className="block w-full text-sm text-[var(--text-secondary)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--accent-blush)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--accent-rose)] disabled:opacity-50"
      />

      {uploading && (
        <output className="mt-2 block text-sm text-[var(--text-secondary)]">
          Uploading…
        </output>
      )}

      {atCapacity && (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          You have attached the maximum of {RETURN_EVIDENCE_MAX} photos.
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
