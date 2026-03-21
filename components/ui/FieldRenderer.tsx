'use client';

import { PasswordStrengthChecklist } from '@/components/auth/PasswordStrengthChecklist';
import { TextareaInput } from '@/components/ui/TextareaInput';
import { SelectInput } from '@/components/ui/SelectInput';
import { TextInput } from '@/components/ui/TextInput';
import type { FieldRendererProps } from '@/components/ui/DynamicFormTypes';

export function FieldRenderer({
  field,
  value,
  error,
  showPassword,
  onChange,
  onTogglePassword,
  onBlur,
}: FieldRendererProps) {
  const errorId = `${field.id}-error`;
  const describedBy = error ? errorId : undefined;
  const subProps = { field, value, describedBy, error, onChange };
  const handleBlur = field.validateOnBlur ? () => onBlur(field.name) : undefined;

  return (
    <div>
      <label
        htmlFor={field.id}
        className="block text-sm font-medium text-gray-700 mb-1"
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
        <p id={errorId} className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
      {field.type === 'password' && field.showStrengthChecklist && (
        <PasswordStrengthChecklist password={value} />
      )}
    </div>
  );
}
