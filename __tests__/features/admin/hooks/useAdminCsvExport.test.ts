// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAdminCsvExport } from '@/features/admin/hooks/useAdminCsvExport'

const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
const mockRevokeObjectURL = vi.fn()
const mockClick = vi.fn()

describe('useAdminCsvExport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    URL.createObjectURL = mockCreateObjectURL
    URL.revokeObjectURL = mockRevokeObjectURL
    HTMLAnchorElement.prototype.click = mockClick
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('downloads the blob and reports completion on success', async () => {
    const mockBlob = new Blob(['id,name'], { type: 'text/csv' })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-disposition': 'attachment; filename="orders.csv"',
      }),
      blob: () => Promise.resolve(mockBlob),
    } as unknown as Response)

    const { result } = renderHook(() =>
      useAdminCsvExport({
        exportUrl: '/api/admin/export/orders',
        filenameFallback: 'export.csv',
      })
    )

    await act(async () => {
      await result.current.triggerExport()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(fetch).toHaveBeenCalledWith('/api/admin/export/orders', {
      method: 'GET',
    })
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob)
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalled()
    expect(result.current.progressLabel).toBe('Export complete.')
    expect(result.current.errorMessage).toBeNull()
  })

  it('falls back to the provided filename when no content-disposition header is present', async () => {
    const mockBlob = new Blob(['id,name'], { type: 'text/csv' })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      blob: () => Promise.resolve(mockBlob),
    } as unknown as Response)

    const { result } = renderHook(() =>
      useAdminCsvExport({
        exportUrl: '/api/admin/export/orders',
        filenameFallback: 'orders-export.csv',
      })
    )

    await act(async () => {
      await result.current.triggerExport()
    })

    expect(mockClick).toHaveBeenCalled()
  })

  it('reports an error message and clears loading when the request fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      blob: () => Promise.resolve(new Blob()),
    } as unknown as Response)

    const { result } = renderHook(() =>
      useAdminCsvExport({
        exportUrl: '/api/admin/export/orders',
        filenameFallback: 'export.csv',
      })
    )

    await act(async () => {
      await result.current.triggerExport()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.errorMessage).toBe('Export failed with status 500')
    expect(mockClick).not.toHaveBeenCalled()
  })

  it('reports an error message when fetch rejects', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network down'))

    const { result } = renderHook(() =>
      useAdminCsvExport({
        exportUrl: '/api/admin/export/orders',
        filenameFallback: 'export.csv',
      })
    )

    await act(async () => {
      await result.current.triggerExport()
    })

    expect(result.current.errorMessage).toBe('Network down')
    expect(result.current.loading).toBe(false)
  })
})
