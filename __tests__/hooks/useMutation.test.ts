import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMutation } from '@/hooks/useMutation'

describe('useMutation', () => {
  it('starts with idle state', () => {
    const mutationFn = vi.fn()
    const { result } = renderHook(() => useMutation(mutationFn))

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets loading during mutation', async () => {
    let resolvePromise: (value: string) => void
    const mutationFn = vi.fn(
      () => new Promise<string>((resolve) => (resolvePromise = resolve))
    )

    const { result } = renderHook(() => useMutation(mutationFn))

    let mutatePromise: Promise<void>
    act(() => {
      mutatePromise = result.current.mutate('input')
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolvePromise!('done')
      await mutatePromise!
    })

    expect(result.current.loading).toBe(false)
  })

  it('sets data on success', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ id: 1 })
    const { result } = renderHook(() =>
      useMutation<{ id: number }, string>(mutationFn)
    )

    await act(async () => {
      await result.current.mutate('input')
    })

    expect(result.current.data).toEqual({ id: 1 })
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets error on failure and re-throws', async () => {
    const mutationFn = vi.fn().mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() =>
      useMutation<unknown, string>(mutationFn)
    )

    await act(async () => {
      try {
        await result.current.mutate('input')
      } catch {
        // expected
      }
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('handles non-Error exceptions', async () => {
    const mutationFn = vi.fn().mockRejectedValue('string error')
    const { result } = renderHook(() =>
      useMutation<unknown, string>(mutationFn)
    )

    await act(async () => {
      try {
        await result.current.mutate('input')
      } catch {
        // expected
      }
    })

    expect(result.current.error).toBe('Mutation failed')
  })

  it('resets all state', async () => {
    const mutationFn = vi.fn().mockResolvedValue('data')
    const { result } = renderHook(() => useMutation<string, string>(mutationFn))

    await act(async () => {
      await result.current.mutate('input')
    })

    expect(result.current.data).toBe('data')

    act(() => {
      result.current.reset()
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
