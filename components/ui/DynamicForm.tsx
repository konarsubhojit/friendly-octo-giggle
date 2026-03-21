'use client';

import { useState, useCallback } from 'react';
import { FieldRenderer } from '@/components/ui/FieldRenderer';

// Re-export public types from DynamicFormTypes for backwards compatibility
export type {
  FieldValidateFn,
  SubmitResult,
  SelectOption,
  FieldType,
  FieldDef,
  DynamicFormProps,
} from '@/components/ui/DynamicFormTypes';

import type { DynamicFormProps } from '@/components/ui/DynamicFormTypes';

const DEFAULT_SUBMIT_BTN =
  'px-6 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * A self-managing form component driven by field definitions.
 */
export const DynamicForm = ({
  fields,
  onSubmit,
  initialValues,
  submitLabel = 'Submit',
  submittingLabel = 'Submitting\u2026',
  onCancel,
  cancelLabel = 'Cancel',
  serverError: externalServerError,
  serverSuccess,
  formClassName,
  submitButtonClassName = DEFAULT_SUBMIT_BTN,
}: DynamicFormProps) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.name] = initialValues?.[f.name] ?? f.defaultValue ?? '';
    }
    return init;
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [internalServerError, setInternalServerError] = useState('');
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev));
  }, []);

  const handleBlur = useCallback((name: string) => {
    const field = fields.find((f) => f.name === name);
    if (!field?.validate) return;
    setValues((currentValues) => {
      const err = field.validate?.(currentValues[name] ?? '', currentValues);
      setFieldErrors((prev) => ({ ...prev, [name]: err ?? '' }));
      return currentValues;
    });
  }, [fields]);

  const togglePasswordVisibility = useCallback((id: string) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      setInternalServerError('');

      const errors: Record<string, string> = {};
      for (const field of fields) {
        const err = field.validate?.(values[field.name] ?? '', values);
        if (err) errors[field.name] = err;
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      setSubmitting(true);
      try {
        const result = await onSubmit(values);
        if (typeof result === 'string') {
          setInternalServerError(result);
        } else if (typeof result === 'object' && result !== null) {
          setFieldErrors(result);
        }
      } catch {
        setInternalServerError('An unexpected error occurred. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [fields, values, onSubmit],
  );

  const displayServerError = externalServerError ?? internalServerError;

  return (
    <form onSubmit={handleSubmit} noValidate className={formClassName}>
      {displayServerError && (
        <p
          className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4"
          role="alert"
        >
          {displayServerError}
        </p>
      )}
      {serverSuccess && (
        <output className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4 block">
          {serverSuccess}
        </output>
      )}
      <div className="space-y-4">
        {fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={values[field.name] ?? ''}
            error={fieldErrors[field.name]}
            showPassword={!!showPassword[field.id]}
            onChange={handleChange}
            onTogglePassword={togglePasswordVisibility}
            onBlur={handleBlur}
          />
        ))}
      </div>
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--accent-blush)] rounded-full hover:bg-[var(--accent-cream)] disabled:opacity-50 transition border border-[var(--border-warm)]"
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={submitButtonClassName}
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
