'use client'

import { useState, useCallback } from 'react'

export const useFormState = <T extends Record<string, unknown>>(
  initialState: T
): {
  values: T
  errors: Partial<Record<keyof T, string>>
  handleChange: (name: keyof T, value: unknown) => void
  handleSubmit: (
    onSubmit: (values: T) => void | Promise<void>
  ) => (e: React.SyntheticEvent<HTMLFormElement>) => Promise<void>
  setError: (name: keyof T, error: string) => void
  reset: () => void
  isValid: boolean
} => {
  const [values, setValues] = useState<T>(initialState)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})

  const handleChange = useCallback((name: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      const { [name]: _removed, ...rest } = prev
      return rest as Partial<Record<keyof T, string>>
    })
  }, [])

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void | Promise<void>) =>
      async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        await onSubmit(values)
      },
    [values]
  )

  const setError = useCallback((name: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [name]: error }))
  }, [])

  const reset = useCallback(() => {
    setValues(initialState)
    setErrors({})
  }, [initialState])

  const isValid = Object.keys(errors).length === 0

  return {
    values,
    errors,
    handleChange,
    handleSubmit,
    setError,
    reset,
    isValid,
  }
}
