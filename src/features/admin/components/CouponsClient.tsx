'use client'

import { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { apiClient, ApiError } from '@/lib/api-client'
import { formatMoneyValue } from '@/lib/money'
import { DISCOUNT_TYPES } from '@/lib/constants/discounts'
import { RESOURCE_FORM_PRESENTATIONS } from '@/features/admin/services/form-presentation-rule'
import type {
  AdminCouponRecord,
  AdminCouponRedemptionSummary,
} from '@/features/admin/services/coupon-admin'

// FR-B01/FR-B02: coupons are a low-field-count record, so the canonical rule
// places create/edit in an overlay rather than a dedicated screen.
const COUPON_FORM_PRESENTATION = RESOURCE_FORM_PRESENTATIONS.coupons

interface CouponsClientProps {
  readonly initialCoupons: AdminCouponRecord[]
  readonly initialRedemptions: AdminCouponRedemptionSummary[]
}

interface CouponFormState {
  code: string
  description: string
  discountType: AdminCouponRecord['discountType']
  discountValue: string
  maxDiscountAmount: string
  minCartValue: string
  scopedCategories: string
  scopedProductIds: string
  usageLimit: string
  perUserLimit: string
  stackable: boolean
  isActive: boolean
  startsAt: string
  endsAt: string
}

const EMPTY_FORM: CouponFormState = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxDiscountAmount: '',
  minCartValue: '',
  scopedCategories: '',
  scopedProductIds: '',
  usageLimit: '',
  perUserLimit: '',
  stackable: false,
  isActive: true,
  startsAt: '',
  endsAt: '',
}

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50'

const LABEL_CLASS =
  'block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400'

const CELL_CLASS = 'px-3 py-2 text-sm text-slate-700 dark:text-slate-200'

const toCsvList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const toOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const toOptionalIsoDate = (value: string): string | null => {
  if (!value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const buildPayload = (form: CouponFormState) => ({
  code: form.code,
  description: form.description.trim() || null,
  discountType: form.discountType,
  discountValue: toOptionalNumber(form.discountValue) ?? 0,
  maxDiscountAmount: toOptionalNumber(form.maxDiscountAmount),
  minCartValue: toOptionalNumber(form.minCartValue) ?? 0,
  scopedCategories: toCsvList(form.scopedCategories),
  scopedProductIds: toCsvList(form.scopedProductIds),
  usageLimit: toOptionalNumber(form.usageLimit),
  perUserLimit: toOptionalNumber(form.perUserLimit),
  stackable: form.stackable,
  isActive: form.isActive,
  startsAt: toOptionalIsoDate(form.startsAt),
  endsAt: toOptionalIsoDate(form.endsAt),
})

const toDatetimeLocal = (value: string | null): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formStateFromCoupon = (coupon: AdminCouponRecord): CouponFormState => ({
  code: coupon.code,
  description: coupon.description ?? '',
  discountType: coupon.discountType,
  discountValue: String(coupon.discountValue),
  maxDiscountAmount:
    coupon.maxDiscountAmount === null ? '' : String(coupon.maxDiscountAmount),
  minCartValue: String(coupon.minCartValue),
  scopedCategories: coupon.scopedCategories.join(', '),
  scopedProductIds: coupon.scopedProductIds.join(', '),
  usageLimit: coupon.usageLimit === null ? '' : String(coupon.usageLimit),
  perUserLimit: coupon.perUserLimit === null ? '' : String(coupon.perUserLimit),
  stackable: coupon.stackable,
  isActive: coupon.isActive,
  startsAt: toDatetimeLocal(coupon.startsAt),
  endsAt: toDatetimeLocal(coupon.endsAt),
})

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString() : '—'

const describeValue = (coupon: AdminCouponRecord): string => {
  switch (coupon.discountType) {
    case 'PERCENTAGE':
      return `${coupon.discountValue}%`
    case 'FIXED_AMOUNT':
      return formatMoneyValue(coupon.discountValue)
    case 'FREE_SHIPPING':
      return 'Free shipping'
    case 'BOGO':
      return 'Buy one get one'
  }
}

const describeScope = (coupon: AdminCouponRecord): string => {
  const parts = [...coupon.scopedCategories, ...coupon.scopedProductIds]
  return parts.length > 0 ? parts.join(', ') : 'Entire cart'
}

const describeCaps = (coupon: AdminCouponRecord): string =>
  `${coupon.usageCount}/${coupon.usageLimit ?? '∞'} total · ${coupon.perUserLimit ?? '∞'} per user`

interface CouponFormModalProps {
  readonly editingCoupon: AdminCouponRecord | null
  readonly onClose: () => void
  readonly onSubmit: (
    form: CouponFormState
  ) => Promise<{ success: boolean; conflict?: boolean }>
}

/**
 * Overlay create/edit form for coupons (FR-B01/FR-B02), rendered for both the
 * "add" (editingCoupon === null) and "edit" flows.
 */
const CouponFormModal = ({
  editingCoupon,
  onClose,
  onSubmit,
}: CouponFormModalProps) => {
  const isEditing = editingCoupon !== null
  const [form, setForm] = useState<CouponFormState>(() =>
    editingCoupon ? formStateFromCoupon(editingCoupon) : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState(false)
  const formId = useId()
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    codeInputRef.current?.focus()
  }, [])

  const setField = <K extends keyof CouponFormState>(
    key: K,
    value: CouponFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  const handleClose = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setConflict(false)
    const result = await onSubmit(form)
    setSaving(false)
    if (result.success) {
      onClose()
    } else if (result.conflict) {
      setConflict(true)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-heading`}
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2
            id={`${formId}-heading`}
            className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50"
          >
            {isEditing
              ? `Edit coupon ${editingCoupon.code}`
              : 'Create a coupon'}
          </h2>

          {conflict && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              This coupon was changed by someone else since this form opened.
              Reload and try again.
            </p>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-code`}>
                Code
              </label>
              <input
                id={`${formId}-code`}
                ref={codeInputRef}
                className={INPUT_CLASS}
                value={form.code}
                onChange={(event) => setField('code', event.target.value)}
                placeholder="WELCOME10"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-type`}>
                Discount type
              </label>
              <select
                id={`${formId}-type`}
                className={INPUT_CLASS}
                value={form.discountType}
                disabled={saving}
                onChange={(event) =>
                  setField(
                    'discountType',
                    event.target.value as AdminCouponRecord['discountType']
                  )
                }
              >
                {DISCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-value`}>
                Value (percent or amount)
              </label>
              <input
                id={`${formId}-value`}
                className={INPUT_CLASS}
                type="number"
                min="0"
                step="0.01"
                value={form.discountValue}
                disabled={saving}
                onChange={(event) =>
                  setField('discountValue', event.target.value)
                }
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-max`}>
                Maximum discount (optional)
              </label>
              <input
                id={`${formId}-max`}
                className={INPUT_CLASS}
                type="number"
                min="0"
                step="0.01"
                value={form.maxDiscountAmount}
                disabled={saving}
                onChange={(event) =>
                  setField('maxDiscountAmount', event.target.value)
                }
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-min-cart`}>
                Minimum cart value
              </label>
              <input
                id={`${formId}-min-cart`}
                className={INPUT_CLASS}
                type="number"
                min="0"
                step="0.01"
                value={form.minCartValue}
                disabled={saving}
                onChange={(event) =>
                  setField('minCartValue', event.target.value)
                }
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-description`}>
                Description
              </label>
              <input
                id={`${formId}-description`}
                className={INPUT_CLASS}
                value={form.description}
                disabled={saving}
                onChange={(event) =>
                  setField('description', event.target.value)
                }
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-categories`}>
                Scoped categories (comma separated)
              </label>
              <input
                id={`${formId}-categories`}
                className={INPUT_CLASS}
                value={form.scopedCategories}
                disabled={saving}
                onChange={(event) =>
                  setField('scopedCategories', event.target.value)
                }
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-products`}>
                Scoped product IDs (comma separated)
              </label>
              <input
                id={`${formId}-products`}
                className={INPUT_CLASS}
                value={form.scopedProductIds}
                disabled={saving}
                onChange={(event) =>
                  setField('scopedProductIds', event.target.value)
                }
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-usage-limit`}>
                Global usage cap (blank = unlimited)
              </label>
              <input
                id={`${formId}-usage-limit`}
                className={INPUT_CLASS}
                type="number"
                min="1"
                step="1"
                value={form.usageLimit}
                disabled={saving}
                onChange={(event) => setField('usageLimit', event.target.value)}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-per-user`}>
                Per-user cap (blank = unlimited)
              </label>
              <input
                id={`${formId}-per-user`}
                className={INPUT_CLASS}
                type="number"
                min="1"
                step="1"
                value={form.perUserLimit}
                disabled={saving}
                onChange={(event) =>
                  setField('perUserLimit', event.target.value)
                }
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-starts`}>
                Starts at
              </label>
              <input
                id={`${formId}-starts`}
                className={INPUT_CLASS}
                type="datetime-local"
                value={form.startsAt}
                disabled={saving}
                onChange={(event) => setField('startsAt', event.target.value)}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor={`${formId}-ends`}>
                Expires at
              </label>
              <input
                id={`${formId}-ends`}
                className={INPUT_CLASS}
                type="datetime-local"
                value={form.endsAt}
                disabled={saving}
                onChange={(event) => setField('endsAt', event.target.value)}
              />
            </div>

            <div className="flex items-center gap-6 sm:col-span-2">
              <label
                className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                htmlFor={`${formId}-stackable`}
              >
                <input
                  id={`${formId}-stackable`}
                  type="checkbox"
                  checked={form.stackable}
                  disabled={saving}
                  onChange={(event) =>
                    setField('stackable', event.target.checked)
                  }
                />
                <span>Can be combined with other coupons</span>
              </label>
              <label
                className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                htmlFor={`${formId}-active`}
              >
                <input
                  id={`${formId}-active`}
                  type="checkbox"
                  checked={form.isActive}
                  disabled={saving}
                  onChange={(event) =>
                    setField('isActive', event.target.checked)
                  }
                />
                <span>Active</span>
              </label>
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving} loadingText="Saving…">
                {isEditing ? 'Save changes' : 'Create coupon'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function CouponsClient({
  initialCoupons,
  initialRedemptions,
}: CouponsClientProps) {
  const [coupons, setCoupons] = useState(initialCoupons)
  const [pendingDelete, setPendingDelete] = useState<AdminCouponRecord | null>(
    null
  )
  const [formTarget, setFormTarget] = useState<
    AdminCouponRecord | 'new' | null
  >(null)
  const formId = useId()

  const handleCreate = async (
    form: CouponFormState
  ): Promise<{ success: boolean; conflict?: boolean }> => {
    try {
      const result = await apiClient.post<{
        data: { coupon: AdminCouponRecord }
      }>('/api/admin/coupons', buildPayload(form))
      setCoupons((current) => [result.data.coupon, ...current])
      toast.success(`Coupon ${result.data.coupon.code} created`)
      return { success: true }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create coupon'
      )
      return { success: false }
    }
  }

  const handleUpdate = async (
    coupon: AdminCouponRecord,
    form: CouponFormState
  ): Promise<{ success: boolean; conflict?: boolean }> => {
    try {
      const result = await apiClient.patch<{
        data: { coupon: AdminCouponRecord }
      }>(`/api/admin/coupons/${coupon.id}`, buildPayload(form))
      setCoupons((current) =>
        current.map((entry) =>
          entry.id === coupon.id ? result.data.coupon : entry
        )
      )
      toast.success(`Coupon ${result.data.coupon.code} updated`)
      return { success: true }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          'This coupon was changed by someone else. Reload and try again.'
        )
        return { success: false, conflict: true }
      }
      toast.error(
        error instanceof Error ? error.message : 'Failed to update coupon'
      )
      return { success: false }
    }
  }

  const handleFormSubmit = (
    form: CouponFormState
  ): Promise<{ success: boolean; conflict?: boolean }> => {
    if (formTarget === 'new') return handleCreate(form)
    if (formTarget) return handleUpdate(formTarget, form)
    return Promise.resolve({ success: false })
  }

  const handleToggleActive = async (coupon: AdminCouponRecord) => {
    try {
      const result = await apiClient.patch<{
        data: { coupon: AdminCouponRecord }
      }>(`/api/admin/coupons/${coupon.id}`, { isActive: !coupon.isActive })
      setCoupons((current) =>
        current.map((entry) =>
          entry.id === coupon.id ? result.data.coupon : entry
        )
      )
      toast.success(
        result.data.coupon.isActive ? 'Coupon activated' : 'Coupon deactivated'
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update coupon'
      )
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    try {
      await apiClient.delete(`/api/admin/coupons/${target.id}`)
      setCoupons((current) => current.filter((entry) => entry.id !== target.id))
      toast.success(`Coupon ${target.code} deleted`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete coupon'
      )
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby={`${formId}-list-heading`}>
        <div className="mb-4 flex items-center justify-between">
          <h2
            id={`${formId}-list-heading`}
            className="text-lg font-semibold text-slate-900 dark:text-slate-50"
          >
            Coupons
          </h2>
          <Button type="button" onClick={() => setFormTarget('new')}>
            + Add coupon
          </Button>
        </div>
        {coupons.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No coupons yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className={CELL_CLASS}>Code</th>
                  <th className={CELL_CLASS}>Type</th>
                  <th className={CELL_CLASS}>Value</th>
                  <th className={CELL_CLASS}>Min cart</th>
                  <th className={CELL_CLASS}>Scope</th>
                  <th className={CELL_CLASS}>Caps</th>
                  <th className={CELL_CLASS}>Window</th>
                  <th className={CELL_CLASS}>Status</th>
                  <th className={CELL_CLASS}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr
                    key={coupon.id}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className={`${CELL_CLASS} font-mono`}>{coupon.code}</td>
                    <td className={CELL_CLASS}>{coupon.discountType}</td>
                    <td className={CELL_CLASS}>{describeValue(coupon)}</td>
                    <td className={CELL_CLASS}>
                      {formatMoneyValue(coupon.minCartValue)}
                    </td>
                    <td className={CELL_CLASS}>{describeScope(coupon)}</td>
                    <td className={CELL_CLASS}>{describeCaps(coupon)}</td>
                    <td className={CELL_CLASS}>
                      {formatDate(coupon.startsAt)} →{' '}
                      {formatDate(coupon.endsAt)}
                    </td>
                    <td className={CELL_CLASS}>
                      {coupon.isActive ? 'Active' : 'Inactive'}
                      {coupon.stackable ? ' · stackable' : ''}
                    </td>
                    <td className={CELL_CLASS}>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setFormTarget(coupon)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(coupon)}
                        >
                          {coupon.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => setPendingDelete(coupon)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby={`${formId}-report-heading`}>
        <h2
          id={`${formId}-report-heading`}
          className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          Redemption report
        </h2>
        {initialRedemptions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No redemptions recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className={CELL_CLASS}>Code</th>
                  <th className={CELL_CLASS}>Redemptions</th>
                  <th className={CELL_CLASS}>Remaining</th>
                  <th className={CELL_CLASS}>Discount given</th>
                  <th className={CELL_CLASS}>Last redeemed</th>
                </tr>
              </thead>
              <tbody>
                {initialRedemptions.map((row) => (
                  <tr
                    key={row.couponId}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className={`${CELL_CLASS} font-mono`}>{row.code}</td>
                    <td className={CELL_CLASS}>{row.redemptionCount}</td>
                    <td className={CELL_CLASS}>
                      {row.usageLimit === null
                        ? '∞'
                        : Math.max(0, row.usageLimit - row.usageCount)}
                    </td>
                    <td className={CELL_CLASS}>
                      {formatMoneyValue(row.totalDiscount)}
                    </td>
                    <td className={CELL_CLASS}>
                      {formatDate(row.lastRedeemedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formTarget !== null && COUPON_FORM_PRESENTATION === 'overlay' && (
        <CouponFormModal
          editingCoupon={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete coupon"
        message={`Delete coupon ${pendingDelete?.code ?? ''}? Existing orders keep their recorded discount.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
