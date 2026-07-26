'use client'

import { useCallback, useId, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { apiClient } from '@/lib/api-client'
import { formatMoneyValue } from '@/lib/money'
import { DISCOUNT_TYPES } from '@/features/cart/services/coupon-service'
import type {
  AdminCouponRecord,
  AdminCouponRedemptionSummary,
} from '@/features/admin/services/coupon-admin'

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

export default function CouponsClient({
  initialCoupons,
  initialRedemptions,
}: CouponsClientProps) {
  const [coupons, setCoupons] = useState(initialCoupons)
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AdminCouponRecord | null>(
    null
  )
  const formId = useId()

  const setField = useCallback(
    <K extends keyof CouponFormState>(key: K, value: CouponFormState[K]) => {
      setForm((current) => ({ ...current, [key]: value }))
    },
    []
  )

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await apiClient.post<{
        data: { coupon: AdminCouponRecord }
      }>('/api/admin/coupons', buildPayload(form))
      setCoupons((current) => [result.data.coupon, ...current])
      setForm(EMPTY_FORM)
      toast.success(`Coupon ${result.data.coupon.code} created`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create coupon'
      )
    } finally {
      setSaving(false)
    }
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
      <section aria-labelledby={`${formId}-heading`}>
        <h2
          id={`${formId}-heading`}
          className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          Create a coupon
        </h2>
        <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor={`${formId}-code`}>
              Code
            </label>
            <input
              id={`${formId}-code`}
              className={INPUT_CLASS}
              value={form.code}
              onChange={(event) => setField('code', event.target.value)}
              placeholder="WELCOME10"
              required
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
              onChange={(event) => setField('minCartValue', event.target.value)}
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
              onChange={(event) => setField('description', event.target.value)}
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
              onChange={(event) => setField('perUserLimit', event.target.value)}
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
                onChange={(event) =>
                  setField('stackable', event.target.checked)
                }
              />
              Can be combined with other coupons
            </label>
            <label
              className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
              htmlFor={`${formId}-active`}
            >
              <input
                id={`${formId}-active`}
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setField('isActive', event.target.checked)}
              />
              Active
            </label>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" loading={saving} loadingText="Saving…">
              Create coupon
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby={`${formId}-list-heading`}>
        <h2
          id={`${formId}-list-heading`}
          className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          Coupons
        </h2>
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
