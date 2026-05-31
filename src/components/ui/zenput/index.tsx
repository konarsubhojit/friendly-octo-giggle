'use client'

/**
 * App-wide adapter layer for the {@link https://www.npmjs.com/package/zenput | zenput}
 * component library.
 *
 * **Always import zenput components from this module** (e.g.
 * `import { TextInput } from '@/components/ui/zenput'`) instead of directly from
 * `'zenput'`. The adapter applies app-default props (`fullWidth`, `size`,
 * `variant`) and shimms behavioural rough-edges such as
 * `NumberInput.onChange(value: number | undefined)`.
 *
 * See `docs/development.md` → "zenput Adapter Layer" for guidance on when to
 * use zenput vs. the in-repo `src/components/ui/*` primitives.
 */

import { forwardRef } from 'react'
import {
  TextInput as ZenputTextInput,
  type TextInputProps as ZenputTextInputProps,
  TextArea as ZenputTextArea,
  type TextAreaProps as ZenputTextAreaProps,
  SelectInput as ZenputSelectInput,
  type SelectInputProps as ZenputSelectInputProps,
  FileInput as ZenputFileInput,
  type FileInputProps as ZenputFileInputProps,
  MoneyInput as ZenputMoneyInput,
  type MoneyInputProps as ZenputMoneyInputProps,
  DataTable as ZenputDataTable,
} from 'zenput'

export { NumberField } from './NumberField'
export type { NumberFieldProps } from './NumberField'

// Re-export commonly used zenput types so consumers only need to import from
// the adapter module.
export type {
  TextInputProps,
  TextAreaProps,
  SelectInputProps,
  SelectOption,
  FileInputProps,
  MoneyInputProps,
  CurrencyOption,
  NumberInputProps,
  InputSize,
  InputVariant,
  ValidationState,
  DataTableProps,
  DataTableColumn,
  DataTableRecord,
} from 'zenput'

/** App default visual size for zenput input components. */
export const DEFAULT_INPUT_SIZE = 'md' as const
/** App default visual variant for zenput input components. */
export const DEFAULT_INPUT_VARIANT = 'outlined' as const

/**
 * Adapter wrapper around zenput `TextInput` that defaults to `fullWidth`,
 * the app size, and the app variant. Any explicit prop overrides the default.
 */
export const TextInput = forwardRef<HTMLInputElement, ZenputTextInputProps>(
  function TextInput(
    {
      fullWidth = true,
      size = DEFAULT_INPUT_SIZE,
      variant = DEFAULT_INPUT_VARIANT,
      ...rest
    },
    ref
  ) {
    return (
      <ZenputTextInput
        ref={ref}
        fullWidth={fullWidth}
        size={size}
        variant={variant}
        {...rest}
      />
    )
  }
)

/** Adapter wrapper around zenput `TextArea` with app defaults. */
export const TextArea = forwardRef<HTMLTextAreaElement, ZenputTextAreaProps>(
  function TextArea(
    {
      fullWidth = true,
      size = DEFAULT_INPUT_SIZE,
      variant = DEFAULT_INPUT_VARIANT,
      ...rest
    },
    ref
  ) {
    return (
      <ZenputTextArea
        ref={ref}
        fullWidth={fullWidth}
        size={size}
        variant={variant}
        {...rest}
      />
    )
  }
)

/** Adapter wrapper around zenput `SelectInput` with app defaults. */
export const SelectInput = forwardRef<
  HTMLSelectElement,
  ZenputSelectInputProps
>(function SelectInput(
  {
    fullWidth = true,
    size = DEFAULT_INPUT_SIZE,
    variant = DEFAULT_INPUT_VARIANT,
    ...rest
  },
  ref
) {
  return (
    <ZenputSelectInput
      ref={ref}
      fullWidth={fullWidth}
      size={size}
      variant={variant}
      {...rest}
    />
  )
})

/** Adapter wrapper around zenput `FileInput` with app defaults. */
export const FileInput = forwardRef<HTMLInputElement, ZenputFileInputProps>(
  function FileInput(
    {
      fullWidth = true,
      size = DEFAULT_INPUT_SIZE,
      variant = DEFAULT_INPUT_VARIANT,
      ...rest
    },
    ref
  ) {
    return (
      <ZenputFileInput
        ref={ref}
        fullWidth={fullWidth}
        size={size}
        variant={variant}
        {...rest}
      />
    )
  }
)

/** Adapter wrapper around zenput `MoneyInput` with app defaults. */
export function MoneyInput({
  fullWidth = true,
  size = DEFAULT_INPUT_SIZE,
  variant = DEFAULT_INPUT_VARIANT,
  ...rest
}: ZenputMoneyInputProps) {
  return (
    <ZenputMoneyInput
      fullWidth={fullWidth}
      size={size}
      variant={variant}
      {...rest}
    />
  )
}

/**
 * Re-export of zenput `DataTable` for routing through the adapter module.
 *
 * `DataTable` does not currently accept `fullWidth` / `size` / `variant` props,
 * so this is a transparent re-export today. Routing through the adapter still
 * matters because future app-wide table defaults (loading states, empty
 * messages, pagination styling) will be applied here.
 */
export const DataTable = ZenputDataTable
