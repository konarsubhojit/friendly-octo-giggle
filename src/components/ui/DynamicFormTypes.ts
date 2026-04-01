import type { ReactNode } from 'react';

export type FieldValidateFn = (
  value: string,
  allValues: Readonly<Record<string, string>>,
) => string | undefined;

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

export interface FieldDef {
  readonly id: string;
  readonly name: string;
  readonly label: ReactNode;
  readonly type: FieldType;
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly defaultValue?: string;
  readonly autoFocus?: boolean;
  readonly validate?: FieldValidateFn;
  readonly validateOnBlur?: boolean;
  readonly rows?: number;
  readonly options?: ReadonlyArray<SelectOption>;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly showPasswordToggle?: boolean;
  readonly showStrengthChecklist?: boolean;
}

export interface DynamicFormProps {
  readonly fields: ReadonlyArray<FieldDef>;
  readonly onSubmit: (
    values: Readonly<Record<string, string>>,
  ) => Promise<SubmitResult> | SubmitResult;
  readonly initialValues?: Readonly<Record<string, string>>;
  readonly submitLabel?: string;
  readonly submittingLabel?: string;
  readonly onCancel?: () => void;
  readonly cancelLabel?: string;
  readonly serverError?: string;
  readonly serverSuccess?: string;
  readonly formClassName?: string;
  readonly submitButtonClassName?: string;
}

// Shared style constants used by DynamicForm sub-components
export const BASE_INPUT =
  'w-full px-4 py-3 text-base border rounded-xl focus:ring-2 focus:ring-[var(--accent-rose)] focus:border-transparent transition-all bg-[var(--surface)] text-[var(--foreground)] placeholder-[var(--text-muted)]';

export const borderCls = (hasError: boolean) =>
  hasError ? 'border-red-400' : 'border-[var(--border-warm)]';

// Shared prop interfaces for input sub-components
export interface InputSubProps {
  readonly field: FieldDef;
  readonly value: string;
  readonly describedBy: string | undefined;
  readonly error: string | undefined;
  readonly onChange: (name: string, value: string) => void;
}

export interface TextInputProps extends InputSubProps {
  readonly showPassword: boolean;
  readonly onTogglePassword: (id: string) => void;
  readonly onBlur?: () => void;
}

export interface FieldRendererProps {
  readonly field: FieldDef;
  readonly value: string;
  readonly error?: string;
  readonly showPassword: boolean;
  readonly onChange: (name: string, value: string) => void;
  readonly onTogglePassword: (id: string) => void;
  readonly onBlur: (name: string) => void;
}
