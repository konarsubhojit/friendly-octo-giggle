import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormState } from '@/hooks/useFormState'

interface TestForm extends Record<string, unknown> {
  name: string
  email: string
}

describe('useFormState', () => {
  const initialState: TestForm = { name: '', email: '' }

  it('returns initial values', () => {
    const { result } = renderHook(() => useFormState(initialState))

    expect(result.current.values).toEqual({ name: '', email: '' })
    expect(result.current.errors).toEqual({})
    expect(result.current.isValid).toBe(true)
  })

  it('updates a field via handleChange', () => {
    const { result } = renderHook(() => useFormState(initialState))

    act(() => {
      result.current.handleChange('name', 'Alice')
    })

    expect(result.current.values.name).toBe('Alice')
    expect(result.current.values.email).toBe('')
  })

  it('clears field error on change', () => {
    const { result } = renderHook(() => useFormState(initialState))

    act(() => {
      result.current.setError('name', 'Required')
    })
    expect(result.current.errors.name).toBe('Required')
    expect(result.current.isValid).toBe(false)

    act(() => {
      result.current.handleChange('name', 'Alice')
    })
    expect(result.current.errors.name).toBeUndefined()
    expect(result.current.isValid).toBe(true)
  })

  it('sets errors and reflects them in isValid', () => {
    const { result } = renderHook(() => useFormState(initialState))

    act(() => {
      result.current.setError('email', 'Invalid email')
    })

    expect(result.current.errors.email).toBe('Invalid email')
    expect(result.current.isValid).toBe(false)
  })

  it('resets form to initial state', () => {
    const { result } = renderHook(() => useFormState(initialState))

    act(() => {
      result.current.handleChange('name', 'Bob')
      result.current.setError('email', 'Required')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.values).toEqual({ name: '', email: '' })
    expect(result.current.errors).toEqual({})
    expect(result.current.isValid).toBe(true)
  })

  it('handleSubmit prevents default and calls onSubmit with values', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() => useFormState(initialState))

    act(() => {
      result.current.handleChange('name', 'Charlie')
    })

    const submitHandler = result.current.handleSubmit(onSubmit)
    const mockEvent = { preventDefault: vi.fn() }

    await act(async () => {
      await submitHandler(
        mockEvent as unknown as React.SyntheticEvent<HTMLFormElement>
      )
    })

    expect(mockEvent.preventDefault).toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Charlie', email: '' })
  })

  it('handleSubmit works with async onSubmit', async () => {
    const asyncSubmit = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useFormState(initialState))

    const submitHandler = result.current.handleSubmit(asyncSubmit)
    const mockEvent = { preventDefault: vi.fn() }

    await act(async () => {
      await submitHandler(
        mockEvent as unknown as React.SyntheticEvent<HTMLFormElement>
      )
    })

    expect(asyncSubmit).toHaveBeenCalledWith(initialState)
  })
})
