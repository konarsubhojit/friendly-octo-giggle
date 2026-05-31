'use client'

import { forwardRef } from 'react'
import {
  NumberInput as ZenputNumberInput,
  type NumberInputProps as ZenputNumberInputProps,
} from 'zenput'

/**
 * Props for {@link NumberField}.
 *
 * Mirrors zenput's `NumberInputProps` but narrows `onChange` to a
 * non-optional-value callback. The underlying zenput component fires
 * `onChange(value: number | undefined)` when the field is cleared; this
 * adapter substitutes `defaultValueOnClear` (default `0`) so consumers can
 * rely on a `(value: number) => void` signature.
 */
export interface NumberFieldProps extends Omit<
  ZenputNumberInputProps,
  'onChange'
> {
  /** Called whenever the value changes. Receives a guaranteed `number`. */
  readonly onChange?: (value: number) => void
  /**
   * Value substituted when the user clears the field (zenput emits
   * `undefined`). Defaults to `0`.
   */
  readonly defaultValueOnClear?: number
}

/**
 * App-wide adapter around zenput's `NumberInput` that:
 *  - normalises `onChange(value: number | undefined)` to `(value: number) => void`
 *    with a configurable fallback (`defaultValueOnClear`).
 *  - applies the default `fullWidth` styling used across the admin surface.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  function NumberField(
    { onChange, defaultValueOnClear = 0, fullWidth = true, ...rest },
    ref
  ) {
    return (
      <ZenputNumberInput
        ref={ref}
        fullWidth={fullWidth}
        onChange={(value) => {
          if (!onChange) return
          onChange(value ?? defaultValueOnClear)
        }}
        {...rest}
      />
    )
  }
)
