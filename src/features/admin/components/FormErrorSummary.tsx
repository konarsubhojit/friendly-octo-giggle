'use client'

/**
 * Shared field-error/error-summary pattern (FR-B04, T066) used by every
 * converted overlay/dedicated-screen form (categories, coupons, products).
 *
 * Renders an accessible alert banner listing every outstanding validation
 * or submit error so users don't have to hunt through the form to find
 * what's wrong. Individual fields still render their own inline
 * `errorMessage` next to the input; this summary is the single place that
 * announces *how many* errors exist and links them together for screen
 * readers (`role="alert"`, `aria-live="assertive"`).
 */

export interface FormErrorSummaryProps {
  /**
   * Field-level errors keyed by field name/label, e.g.
   * `{ name: 'Name is required' }`. Only truthy values are rendered.
   */
  readonly fieldErrors?: Record<string, string | undefined>
  /**
   * A general, non-field-specific error (e.g. a network failure or a
   * stale-record conflict message) to show above any field errors.
   */
  readonly formError?: string | null
}

export function countFormErrors(
  fieldErrors?: Record<string, string | undefined>
): number {
  if (!fieldErrors) return 0
  return Object.values(fieldErrors).filter(Boolean).length
}

const FormErrorSummary = ({
  fieldErrors,
  formError,
}: FormErrorSummaryProps) => {
  const count = countFormErrors(fieldErrors)

  if (!formError && count === 0) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="form-error-summary"
      className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      {formError && <p className="font-semibold">{formError}</p>}
      {count > 0 && (
        <p className={formError ? 'mt-2 font-semibold' : 'font-semibold'}>
          {count === 1
            ? 'Please fix 1 error below.'
            : `Please fix ${count} errors below.`}
        </p>
      )}
    </div>
  )
}

export default FormErrorSummary
