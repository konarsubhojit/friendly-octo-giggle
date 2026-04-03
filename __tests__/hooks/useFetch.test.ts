import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFetch } from '@/hooks/useFetch'

describe('useFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches data on mount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { items: [1, 2] } }),
      })
    )

    const { result } = renderHook(() =>
      useFetch<{ items: number[] }>('/api/items')
    )

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual({ items: [1, 2] })
    expect(result.current.error).toBeNull()
  })

  it('unwraps data property from response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'unwrapped' }),
      })
    )

    const { result } = renderHook(() => useFetch<string>('/api/data'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBe('unwrapped')
  })

  it('uses direct response when no data property', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'direct' }),
      })
    )

    const { result } = renderHook(() =>
      useFetch<{ name: string }>('/api/direct')
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual({ name: 'direct' })
  })

  it('sets error on HTTP error with error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      })
    )

    const { result } = renderHook(() => useFetch('/api/missing'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Not found')
    expect(result.current.data).toBeNull()
  })

  it('sets fallback error when error response is not parseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error('parse fail')),
      })
    )

    const { result } = renderHook(() => useFetch('/api/bad'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to fetch data')
  })

  it('sets error on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )

    const { result } = renderHook(() => useFetch('/api/fail'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Network error')
  })

  it('handles non-Error exceptions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'))

    const { result } = renderHook(() => useFetch('/api/fail'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('An error occurred')
  })

  it('refetch triggers a new fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'first' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useFetch<string>('/api/data'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'second' }),
    })

    result.current.refetch()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
