import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCursorPagination } from '@/hooks/useCursorPagination'

const mockResponse = (
  items: unknown[],
  nextCursor: string | null,
  hasMore: boolean,
  totalCount: number
) => ({
  ok: true,
  json: () =>
    Promise.resolve({
      data: { items, nextCursor, hasMore, totalCount },
    }),
})

describe('useCursorPagination', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches first page on mount', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          mockResponse([{ id: 1 }, { id: 2 }], 'cursor-2', true, 20)
        )
    )

    const { result } = renderHook(() =>
      useCursorPagination({
        url: '/api/items',
        dataKey: 'items',
        pageSize: 2,
      })
    )

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.current.hasMore).toBe(true)
    expect(result.current.totalCount).toBe(20)
    expect(result.current.currentPage).toBe(1)
  })

  it('does not fetch when enabled is false', () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    renderHook(() =>
      useCursorPagination({
        url: '/api/items',
        dataKey: 'items',
        enabled: false,
      })
    )

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('applies transform function to items', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          mockResponse([{ id: 1, name: 'test' }], null, false, 1)
        )
    )

    const { result } = renderHook(() =>
      useCursorPagination<{ id: number; name: string }>({
        url: '/api/items',
        dataKey: 'items',
        transform: (item) => ({ ...item, name: item.name.toUpperCase() }),
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.items[0].name).toBe('TEST')
  })

  it('sets error on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
    )

    const { result } = renderHook(() =>
      useCursorPagination({
        url: '/api/items',
        dataKey: 'items',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Server error')
  })

  it('handles network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure'))
    )

    const { result } = renderHook(() =>
      useCursorPagination({
        url: '/api/items',
        dataKey: 'items',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Network failure')
  })

  it('calculates totalPages from totalCount and pageSize', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse([{ id: 1 }], 'c2', true, 25))
    )

    const { result } = renderHook(() =>
      useCursorPagination({
        url: '/api/items',
        dataKey: 'items',
        pageSize: 10,
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.totalPages).toBe(3)
  })

  it('handleSearch resets to page 1 and updates search', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockResponse([{ id: 1 }], null, false, 1))
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() =>
      useCursorPagination({
        url: '/api/items',
        dataKey: 'items',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSearchInput('test query')
    })

    act(() => {
      result.current.handleSearch({ preventDefault: vi.fn() })
    })

    await waitFor(() => {
      expect(result.current.search).toBe('test query')
    })

    expect(result.current.currentPage).toBe(1)
  })

  it('handleRefresh resets all state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse([{ id: 1 }], null, false, 1))
    )

    const { result } = renderHook(() =>
      useCursorPagination({
        url: '/api/items',
        dataKey: 'items',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.handleRefresh()
    })

    expect(result.current.currentPage).toBe(1)
    expect(result.current.search).toBe('')
    expect(result.current.searchInput).toBe('')
  })

  it('handleFirst does nothing when already on page 1', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockResponse([{ id: 1 }], 'c2', true, 10))
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() =>
      useCursorPagination({
        url: '/api/items',
        dataKey: 'items',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const callCount = mockFetch.mock.calls.length

    act(() => {
      result.current.handleFirst()
    })

    expect(mockFetch.mock.calls.length).toBe(callCount)
  })

  it('handleNext does nothing when no more pages', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockResponse([{ id: 1 }], null, false, 1))
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() =>
      useCursorPagination({
        url: '/api/items',
        dataKey: 'items',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const callCount = mockFetch.mock.calls.length

    act(() => {
      result.current.handleNext()
    })

    expect(mockFetch.mock.calls.length).toBe(callCount)
  })
})
