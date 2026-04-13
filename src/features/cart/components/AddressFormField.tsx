interface AddressFormFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder: string
  readonly maxLength: number
  readonly required?: boolean
  readonly readOnly?: boolean
  readonly error?: string
  readonly errorId?: string
  readonly inputClassName: string
}

export const AddressFormField = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  required,
  readOnly,
  error,
  errorId,
  inputClassName,
}: AddressFormFieldProps) => (
  <div>
    <label
      htmlFor={id}
      className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
    >
      {label}
      {required && <span className="text-red-400"> *</span>}
    </label>
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      readOnly={readOnly}
      aria-describedby={error ? errorId : undefined}
      aria-invalid={Boolean(error)}
      className={inputClassName}
    />
    {error && (
      <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">
        {error}
      </p>
    )}
  </div>
)
