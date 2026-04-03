'use client'

import { PasswordToggleButton } from '@/components/ui/PasswordToggleButton'
import {
  BASE_INPUT,
  borderCls,
  type TextInputProps,
} from '@/components/ui/DynamicFormTypes'

export function TextInput({
  field,
  value,
  describedBy,
  error,
  showPassword,
  onChange,
  onTogglePassword,
  onBlur,
}: TextInputProps) {
  const isPassword = field.type === 'password'
  const hasToggle = isPassword && field.showPasswordToggle
  const passwordType = showPassword ? 'text' : 'password'
  const resolvedType = isPassword ? passwordType : field.type
  const labelStr =
    typeof field.label === 'string' ? field.label.toLowerCase() : 'password'

  return (
    <div className={hasToggle ? 'relative' : undefined}>
      <input
        id={field.id}
        name={field.name}
        type={resolvedType}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        autoFocus={field.autoFocus}
        min={field.min}
        max={field.max}
        step={field.step}
        aria-describedby={describedBy}
        onBlur={onBlur}
        className={`${BASE_INPUT}${hasToggle ? ' pr-12' : ''} ${borderCls(Boolean(error))}`}
      />
      {hasToggle && (
        <PasswordToggleButton
          showPassword={showPassword}
          onToggle={() => onTogglePassword(field.id)}
          label={showPassword ? `Hide ${labelStr}` : `Show ${labelStr}`}
        />
      )}
    </div>
  )
}
