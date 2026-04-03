'use client'

import { PasswordStrengthChecklist } from '@/components/ui/PasswordStrengthChecklist'
import { TextareaInput } from '@/components/ui/TextareaInput'
import { SelectInput } from '@/components/ui/SelectInput'
import { TextInput } from '@/components/ui/TextInput'
import type { FieldRendererProps } from '@/components/ui/DynamicFormTypes'

export function FieldRenderer({
  field,
  value,
  error,
  showPassword,
  onChange,
  onTogglePassword,
  onBlur,
}: FieldRendererProps) {
  const errorId = `${field.id}-error`
  const describedBy = error ? errorId : undefined
  const subProps = { field, value, describedBy, error, onChange }
  const handleBlur = field.validateOnBlur ? () => onBlur(field.name) : undefined

  return (
    <div>
      <label
        htmlFor={field.id}
        className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
      >
        {field.label}
      </label>
      {field.type === 'textarea' && <TextareaInput {...subProps} />}
      {field.type === 'select' && <SelectInput {...subProps} />}
      {field.type !== 'textarea' && field.type !== 'select' && (
        <TextInput
          {...subProps}
          showPassword={showPassword}
          onTogglePassword={onTogglePassword}
          onBlur={handleBlur}
        />
      )}
      {error && (
        <p
          id={errorId}
          className="mt-1.5 text-sm text-red-600"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      {field.type === 'password' && field.showStrengthChecklist && (
        <PasswordStrengthChecklist password={value} />
      )}
    </div>
  )
}
