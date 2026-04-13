interface PincodeFieldProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly loading: boolean
  readonly error?: string
  readonly inputClassName: string
}

export const PincodeField = ({
  value,
  onChange,
  loading,
  error,
  inputClassName,
}: PincodeFieldProps) => (
  <div>
    <label
      htmlFor="checkout-pincode"
      className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
    >
      Pin Code <span className="text-red-400">*</span>
    </label>
    <div className="relative">
      <input
        id="checkout-pincode"
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="6-digit pin code"
        maxLength={6}
        aria-describedby={error ? 'pincode-error' : undefined}
        aria-invalid={Boolean(error)}
        className={inputClassName}
      />
      {loading && (
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-warm)] border-t-transparent"
          aria-label="Looking up pin code"
        />
      )}
    </div>
    {error && (
      <p id="pincode-error" className="mt-1 text-xs text-red-500" role="alert">
        {error}
      </p>
    )}
  </div>
)
