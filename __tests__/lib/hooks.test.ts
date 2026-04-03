// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { useFetch } from '@/hooks/useFetch'
import { useMutation } from '@/hooks/useMutation'
import { useFormState } from '@/hooks/useFormState'
import { useDebounce } from '@/hooks/useDebounce'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useCursorPagination } from '@/hooks/useCursorPagination'

describe('useFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with loading=true and data=null', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => {})) // never resolves
    )
    const { result } = renderHook(() => useFetch('/api/test'))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('sets data on successful fetch with .data wrapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: 1 } }),
      })
    )
    const { result } = renderHook(() => useFetch<{ id: number }>('/api/test'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ id: 1 })
    expect(result.current.error).toBeNull()
  })

  it('sets data on successful fetch without .data wrapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 2 }),
      })
    )
    const { result } = renderHook(() => useFetch<{ id: number }>('/api/test'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ id: 2 })
  })

  it('sets error on failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      })
    )
    const { result } = renderHook(() => useFetch('/api/missing'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Not found')
    expect(result.current.data).toBeNull()
  })

  it('sets error on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )
    const { result } = renderHook(() => useFetch('/api/test'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
  })

  it('sets generic error on non-Error throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('unknown'))
    const { result } = renderHook(() => useFetch('/api/test'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('An error occurred')
  })

  it('refetch triggers another fetch call', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 3 } }),
    })
    vi.stubGlobal('fetch', mockFetch)
    const { result } = renderHook(() => useFetch('/api/test'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.refetch()
    })
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
  })
})

describe('useMutation', () => {
  it('starts with loading=false, data=null, error=null', () => {
    const { result } = renderHook(() =>
      useMutation(async (v: string) => v.toUpperCase())
    )
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('sets loading during mutation', async () => {
    let resolvePromise: ((v: string) => void) | undefined
    const mutationFn = vi.fn(
      () => new Promise<string>((r) => (resolvePromise = r))
    )
    const { result } = renderHook(() => useMutation(mutationFn))
    act(() => {
      result.current.mutate('hello').catch(() => {})
    })
    expect(result.current.loading).toBe(true)
    await act(() => {
      resolvePromise?.('HELLO')
      return Promise.resolve()
    })
    expect(result.current.loading).toBe(false)
  })

  it('sets data on success', async () => {
    const { result } = renderHook(() =>
      useMutation(async (v: string) => v.toUpperCase())
    )
    await act(async () => {
      await result.current.mutate('hello')
    })
    expect(result.current.data).toBe('HELLO')
    expect(result.current.error).toBeNull()
  })

  it('sets error and rethrows on failure', async () => {
    const { result } = renderHook(() =>
      useMutation(async (_: string) => {
        throw new Error('mutation failed')
      })
    )
    await act(async () => {
      await result.current.mutate('test').catch(() => {})
    })
    expect(result.current.error).toBe('mutation failed')
    expect(result.current.loading).toBe(false)
  })

  it('sets generic error on non-Error throw', async () => {
    const { result } = renderHook(() =>
      useMutation(async (_: string) => {
        throw 'not an error'
      })
    )
    await act(async () => {
      await result.current.mutate('test').catch(() => {})
    })
    expect(result.current.error).toBe('Mutation failed')
  })

  it('reset clears state', async () => {
    const { result } = renderHook(() =>
      useMutation(async (v: string) => v.toUpperCase())
    )
    await act(async () => {
      await result.current.mutate('hello')
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})

describe('useFormState', () => {
  it('initialises with provided state', () => {
    const { result } = renderHook(() => useFormState({ name: '', age: 0 }))
    expect(result.current.values).toEqual({ name: '', age: 0 })
    expect(result.current.errors).toEqual({})
    expect(result.current.isValid).toBe(true)
  })

  it('handleChange updates values and clears field error', () => {
    const { result } = renderHook(() => useFormState({ name: '' }))
    act(() => {
      result.current.setError('name', 'required')
    })
    expect(result.current.errors.name).toBe('required')
    act(() => {
      result.current.handleChange('name', 'Alice')
    })
    expect(result.current.values.name).toBe('Alice')
    expect(result.current.errors.name).toBeUndefined()
  })

  it('setError marks field invalid', () => {
    const { result } = renderHook(() => useFormState({ name: '' }))
    act(() => {
      result.current.setError('name', 'required')
    })
    expect(result.current.isValid).toBe(false)
  })

  it('handleSubmit calls onSubmit with values', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() => useFormState({ name: 'Alice' }))
    const mockSubmitEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.SyntheticEvent<HTMLFormElement>
    await act(async () => {
      await result.current.handleSubmit(onSubmit)(mockSubmitEvent)
    })
    expect(mockSubmitEvent.preventDefault).toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Alice' })
  })

  it('reset restores initial state', () => {
    const { result } = renderHook(() => useFormState({ name: '' }))
    act(() => {
      result.current.handleChange('name', 'Bob')
      result.current.setError('name', 'err')
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.values).toEqual({ name: '' })
    expect(result.current.errors).toEqual({})
  })
})

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300))
    expect(result.current).toBe('hello')
  })

  it('does not update before delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 300 } }
    )
    rerender({ value: 'world', delay: 300 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('hello')
  })

  it('updates after delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 300 } }
    )
    rerender({ value: 'world', delay: 300 })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('world')
  })
})

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns initial value when nothing in localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('reads existing value from localStorage', () => {
    localStorage.setItem('key', JSON.stringify('stored'))
    const { result } = renderHook(() => useLocalStorage('key', 'default'))
    expect(result.current[0]).toBe('stored')
  })

  it('sets value in localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'default'))
    act(() => {
      result.current[1]('updated')
    })
    expect(result.current[0]).toBe('updated')
    expect(localStorage.getItem('key')).toBe(JSON.stringify('updated'))
  })

  it('supports updater function', () => {
    const { result } = renderHook(() => useLocalStorage('count', 0))
    act(() => {
      result.current[1]((prev) => prev + 1)
    })
    expect(result.current[0]).toBe(1)
  })

  it('returns initial value when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage error')
    })
    const { result } = renderHook(() => useLocalStorage('key', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('handles localStorage.setItem throwing gracefully', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full')
    })
    const { result } = renderHook(() => useLocalStorage('key', 'default'))
    expect(() =>
      act(() => {
        result.current[1]('new value')
      })
    ).not.toThrow()
  })
})

describe('useCursorPagination', () => {
  const mockOrders = [
    {
      id: 'ORD1234567',
      status: 'PENDING',
      createdAt: '2024-01-02T00:00:00.000Z',
    },
    {
      id: 'ORD2345678',
      status: 'SHIPPED',
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('starts loading when enabled=true', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    expect(result.current.loading).toBe(true)
    expect(result.current.items).toEqual([])
  })

  it('does not start loading when enabled=false', () => {
    vi.stubGlobal('fetch', vi.fn())
    const { result } = renderHook(() =>
      useCursorPagination({
        url: '/api/orders',
        dataKey: 'orders',
        enabled: false,
      })
    )
    expect(result.current.loading).toBe(false)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('fetches items and sets state on success (flat response)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            orders: mockOrders,
            nextCursor: null,
            hasMore: false,
          }),
      })
    )
    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(2)
    expect(result.current.hasMore).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('fetches items from nested data wrapper (apiSuccess format)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              users: [{ id: 'u1' }],
              nextCursor: 'cursor123',
              hasMore: true,
            },
          }),
      })
    )
    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/admin/users', dataKey: 'users' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.hasMore).toBe(true)
  })

  it('applies transform function to items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            users: [{ id: 'u1', _count: { orders: 5 } }],
            nextCursor: null,
            hasMore: false,
          }),
      })
    )
    type User = {
      id: string
      _count?: { orders: number }
      orderCount?: number
    }
    const transform = (user: User): User => ({
      ...user,
      orderCount: user._count?.orders ?? 0,
    })
    const { result } = renderHook(() =>
      useCursorPagination<User>({
        url: '/api/admin/users',
        dataKey: 'users',
        transform,
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect((result.current.items[0] as User).orderCount).toBe(5)
  })

  it('sets error state on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })
    )
    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Unauthorized')
    expect(result.current.items).toEqual([])
  })

  it('sets fallback error when response json fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error('parse error')),
      })
    )
    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to load orders')
  })

  it('sets error on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )
    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
  })

  it('handleSearch resets cursor and applies search', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          orders: mockOrders,
          nextCursor: null,
          hasMore: false,
        }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSearchInput('ORD')
    })

    const fakeEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>
    await act(async () => {
      result.current.handleSearch(fakeEvent)
    })

    expect(fakeEvent.preventDefault).toHaveBeenCalled()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.search).toBe('ORD')
    expect(result.current.currentPage).toBe(1)
  })

  it('handleNext advances page when hasMore is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: mockOrders,
              nextCursor: '2024-01-01T00:00:00.000Z',
              hasMore: true,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ orders: [], nextCursor: null, hasMore: false }),
        })
    )

    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMore).toBe(true)

    act(() => {
      result.current.handleNext()
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.currentPage).toBe(2)
  })

  it('handleNext does nothing when hasMore is false', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          orders: mockOrders,
          nextCursor: null,
          hasMore: false,
        }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.handleNext())
    expect(result.current.currentPage).toBe(1)
  })

  it('handlePrev goes back to previous page', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: mockOrders,
              nextCursor: '2024-01-01T00:00:00.000Z',
              hasMore: true,
            }),
        })
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({ orders: [], nextCursor: null, hasMore: false }),
        })
    )

    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.handleNext())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.currentPage).toBe(2)

    act(() => result.current.handlePrev())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.currentPage).toBe(1)
  })

  it('handlePrev does nothing on first page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            orders: mockOrders,
            nextCursor: null,
            hasMore: false,
          }),
      })
    )
    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.handlePrev())
    expect(result.current.currentPage).toBe(1)
  })

  it('handleRefresh resets all state', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          orders: mockOrders,
          nextCursor: 'cursor',
          hasMore: true,
        }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSearchInput('test')
      result.current.handleRefresh()
    })

    expect(result.current.search).toBe('')
    expect(result.current.searchInput).toBe('')
    expect(result.current.currentPage).toBe(1)
  })

  it('includes search in fetch URL when search is non-empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ orders: [], nextCursor: null, hasMore: false }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setSearchInput('test query'))
    const fakeEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>
    await act(async () => {
      result.current.handleSearch(fakeEvent)
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const lastCall = mockFetch.mock.calls.at(-1)?.[0] as string
    expect(lastCall).toContain('search=test+query')
  })

  it('exposes totalCount and totalPages from the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            orders: mockOrders,
            nextCursor: 'cursor-2',
            hasMore: true,
            totalCount: 25,
          }),
      })
    )

    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.totalCount).toBe(25)
    expect(result.current.totalPages).toBe(3)
  })

  it('does not share pending requests across hook instances', async () => {
    let resolveFetch:
      | ((value: { ok: boolean; json: () => Promise<unknown> }) => void)
      | undefined
    const fetchMock = vi.fn(
      () =>
        new Promise<{ ok: boolean; json: () => Promise<unknown> }>(
          (resolve) => {
            resolveFetch = resolve
          }
        )
    )
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )
    renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      resolveFetch?.({
        ok: true,
        json: () =>
          Promise.resolve({
            orders: mockOrders,
            nextCursor: null,
            hasMore: false,
            totalCount: mockOrders.length,
          }),
      })
    })
  })

  it('handlePageSelect jumps directly to a later page', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: mockOrders,
              nextCursor: 'cursor-2',
              hasMore: true,
              totalCount: 25,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: mockOrders,
              nextCursor: 'cursor-2',
              hasMore: true,
              totalCount: 25,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: mockOrders,
              nextCursor: 'cursor-3',
              hasMore: true,
              totalCount: 25,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [mockOrders[0]],
              nextCursor: null,
              hasMore: false,
              totalCount: 25,
            }),
        })
    )

    const { result } = renderHook(() =>
      useCursorPagination({ url: '/api/orders', dataKey: 'orders' })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handlePageSelect(3)
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.currentPage).toBe(3)
  })
})
