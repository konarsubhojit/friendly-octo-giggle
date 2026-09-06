'use client'

import { useCallback, useRef, useState } from 'react'

const CONTENT_DISPOSITION_FILENAME_RE = /filename="?([^";]+)"?/i

const filenameFromContentDisposition = (
  contentDisposition: string | null
): string | null => {
  if (!contentDisposition) return null
  const match = CONTENT_DISPOSITION_FILENAME_RE.exec(contentDisposition)
  return match?.[1] ?? null
}

const triggerBrowserDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

interface UseAdminCsvExportOptions {
  readonly exportUrl: string
  readonly filenameFallback: string
}

interface UseAdminCsvExportResult {
  readonly loading: boolean
  readonly progressLabel: string | null
  readonly errorMessage: string | null
  readonly triggerExport: () => Promise<void>
}

/**
 * Fetches a streamed admin CSV export and triggers a browser download,
 * reporting in-flight progress and failure state for FR-A12.
 */
export const useAdminCsvExport = ({
  exportUrl,
  filenameFallback,
}: UseAdminCsvExportOptions): UseAdminCsvExportResult => {
  const [loading, setLoading] = useState(false)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const triggerExport = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setErrorMessage(null)
    setProgressLabel('Preparing export…')

    try {
      const response = await fetch(exportUrl, { method: 'GET' })

      if (!response.ok) {
        throw new Error(
          `Export failed with status ${response.status.toString()}`
        )
      }

      const blob = await response.blob()
      if (requestIdRef.current !== requestId) return

      const filename =
        filenameFromContentDisposition(
          response.headers.get('content-disposition')
        ) ?? filenameFallback

      triggerBrowserDownload(blob, filename)
      setProgressLabel('Export complete.')
    } catch (error) {
      if (requestIdRef.current !== requestId) return
      setProgressLabel(null)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Export failed. Please try again.'
      )
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [exportUrl, filenameFallback])

  return { loading, progressLabel, errorMessage, triggerExport }
}
