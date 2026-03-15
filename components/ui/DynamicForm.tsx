'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { PasswordToggleButton } from '@/components/auth/PasswordToggleButton';
import { PasswordStrengthChecklist } from '@/components/auth/PasswordStrengthChecklist';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Validator for a single field. Receives the current value and all current form
 * values (for cross-field rules like "confirm password"). Return a non-empty
 * string to signal an error, or `undefined` when the value is valid.
 */
export type FieldValidateFn = (
  value: string,
  allValues: Readonly<Record<string, string>>,
) => string | undefined;

/**
 * What `onSubmit` may return:
 * - `void / undefined` → success (no action taken by the form)
 * - `string`           → top-level server error message
 * - `Record<string, string>` → per-field server errors keyed by `FieldDef.name`
 */
export type SubmitResult = string | Record<string, string> | undefined;

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select';

/** Complete definition of one form field. */
export interface FieldDef {
  /** Unique HTML `id` for the input element. */
  readonly id: string;
  /** Key used in the `values` / `fieldErrors` maps passed to `onSubmit`. */
  readonly name: string;
  /** Label content — may be a string or ReactNode (e.g. with an "(optional)" badge). */
  readonly label: ReactNode;
  readonly type: FieldType;
  readonly placeholder?: string;
  readonly autoComplete?: string;
  /** Pre-filled value when the form first mounts. */
  readonly defaultValue?: string;
  /** Focus this field immediately after mount. */
  readonly autoFocus?: boolean;
  /**
   * Client-side validator. Called for every field on submit. Return a non-empty
   * string to block submission and display an inline error under the field.
   */
  readonly validate?: FieldValidateFn;
  /**
   * When `true`, the `validate` function is also called when the field loses
   * focus (blur). No error is shown while the user is actively typing —
   * only after they leave the field. The error is cleared again as soon as
   * the user edits the field.
   *
   * Useful for cross-field validators such as "confirm password".
   */
  readonly validateOnBlur?: boolean;
  // ── textarea ──────────────────────────────────────────────────────────────
  readonly rows?: number;
  // ── select ────────────────────────────────────────────────────────────────
  readonly options?: ReadonlyArray<SelectOption>;
  // ── number ────────────────────────────────────────────────────────────────
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  // ── password extras ───────────────────────────────────────────────────────
  /** Render a show/hide toggle button inside the password field. */
  readonly showPasswordToggle?: boolean;
  /** Render the `PasswordStrengthChecklist` below the field. */
  readonly showStrengthChecklist?: boolean;
}

export interface DynamicFormProps {
  /** Ordered list of field definitions. */
  readonly fields: ReadonlyArray<FieldDef>;
  /**
   * Called after all client-side validators pass. May be async. Return a
   * `string` for a top-level server error, a `Record<string,string>` for
   * per-field server errors, or nothing on success.
   */
  readonly onSubmit: (
    values: Readonly<Record<string, string>>,
  ) => Promise<SubmitResult> | SubmitResult;
  /** Seed the form with existing data (e.g. loaded from an API). */
  readonly initialValues?: Readonly<Record<string, string>>;
  readonly submitLabel?: string;
  readonly submittingLabel?: string;
  readonly onCancel?: () => void;
  readonly cancelLabel?: string;
  /** Server-error string controlled by the parent (displayed alongside
   *  any error returned from `onSubmit`). */
  readonly serverError?: string;
  /** Success message to display above the fields (controlled by parent). */
  readonly serverSuccess?: string;
  /** Extra class(es) applied to the `<form>` element. */
  readonly formClassName?: string;
  /** Full Tailwind class string for the submit button (overrides default). */
  readonly submitButtonClassName?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const BASE_INPUT =
  'w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all';

const DEFAULT_SUBMIT_BTN =
  'px-6 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed';

const borderCls = (hasError: boolean) =>
  hasError ? 'border-red-400' : 'border-gray-300';

// ─── Input sub-renderers (extracted to keep FieldRenderer CC ≤ 4) ────────────

interface InputSubProps {
  readonly field: FieldDef;
  readonly value: string;
  readonly describedBy: string | undefined;
  readonly error: string | undefined;
  readonly onChange: (name: string, value: string) => void;
}

const TextareaInput = ({ field, value, describedBy, error, onChange }: InputSubProps) => (
  <textarea
    id={field.id}
    value={value}
    onChange={(e) => onChange(field.name, e.target.value)}
    rows={field.rows ?? 4}
    placeholder={field.placeholder}
    autoComplete={field.autoComplete}
    aria-describedby={describedBy}
    className={`${BASE_INPUT} resize-none ${borderCls(Boolean(error))}`}
  />
);

const SelectInput = ({ field, value, describedBy, error, onChange }: InputSubProps) => (
  <select
    id={field.id}
    value={value}
    onChange={(e) => onChange(field.name, e.target.value)}
    aria-describedby={describedBy}
    className={`${BASE_INPUT} bg-white ${borderCls(Boolean(error))}`}
  >
    <option value="">Select…</option>
    {field.options?.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

interface TextInputProps extends InputSubProps {
  readonly showPassword: boolean;
  readonly onTogglePassword: (id: string) => void;
  readonly onBlur?: () => void;
}

const TextInput = ({ field, value, describedBy, error, showPassword, onChange, onTogglePassword, onBlur }: TextInputProps) => {
  const isPassword = field.type === 'password';
  const hasToggle = isPassword && field.showPasswordToggle;
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : field.type;
  const labelStr = typeof field.label === 'string' ? field.label.toLowerCase() : 'password';

  return (
    <div className={hasToggle ? 'relative' : undefined}>
      <input
        id={field.id}
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
  );
};

// ─── FieldRenderer ────────────────────────────────────────────────────────────

interface FieldRendererProps {
  readonly field: FieldDef;
  readonly value: string;
  readonly error?: string;
  readonly showPassword: boolean;
  readonly onChange: (name: string, value: string) => void;
  readonly onTogglePassword: (id: string) => void;
  readonly onBlur: (name: string) => void;
}

const FieldRenderer = ({
  field,
  value,
  error,
  showPassword,
  onChange,
  onTogglePassword,
  onBlur,
}: FieldRendererProps) => {
  const errorId = `${field.id}-error`;
  const describedBy = Boolean(error) ? errorId : undefined;
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
};

// ─── DynamicForm ──────────────────────────────────────────────────────────────

/**
 * A self-managing form component driven by field definitions.
 *
 * - Declare *what* to render and *how* to validate via the `fields` prop.
 * - All form state (values, field errors, submitting flag) is managed internally.
 * - `onSubmit` receives the current values; return an error string or per-field
 *   error map to surface server-side validation, or nothing on success.
 */
export function DynamicForm({
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
}: DynamicFormProps) {
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
    // Clear the inline error for this field as the user types
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

      // Run every field validator
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
          setFieldErrors(result as Record<string, string>);
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
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
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
